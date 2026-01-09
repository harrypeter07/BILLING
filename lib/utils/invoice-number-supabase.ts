import { createClient } from "@/lib/supabase/client"

/**
 * Generates invoice number in format: STORE4-EMP4-YYYYMMDDHHmmss-SEQ
 * STORE4: First 4 chars of store code
 * EMP4: Employee ID (4-char)
 * YYYYMMDDHHmmss: Current timestamp
 * SEQ: 3-digit daily sequence (000-999) per store, resets at midnight
 */
export async function generateInvoiceNumberSupabase(storeId: string, employeeId: string): Promise<string> {
  try {
    if (!storeId) {
      throw new Error("Store ID is required")
    }
    
    const supabase = createClient()
    
    // Fetch store - works for both admins and employees (RLS allows read)
    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("store_code, admin_user_id")
      .eq("id", storeId)
      .maybeSingle()
      
    if (storeError) {
      console.error("[generateInvoiceNumberSupabase] Store fetch error:", {
        error: storeError,
        message: storeError.message,
        code: storeError.code,
        storeId
      })
      throw new Error(`Failed to fetch store: ${storeError.message} (Code: ${storeError.code || 'unknown'})`)
    }
    
    if (!store) {
      throw new Error(`Store not found in Supabase: ${storeId}`)
    }
  
    const storeCode = store.store_code.toUpperCase().slice(0, 4).padEnd(4, "X")
    const empId = (employeeId || "ADMN").toUpperCase().slice(0, 4).padEnd(4, "X")
  
    // Get current date in YYYYMMDD format
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "") // YYYYMMDD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "") // HHmmss
  
    // Get or create sequence for today
    const sequenceKey = `${storeId}-${dateStr}`
    
    // Check if sequence exists - query by store_id and date (works for employees)
    const { data: existingSequence, error: seqCheckError } = await supabase
      .from("invoice_sequences")
      .select("*")
      .eq("store_id", storeId)
      .eq("date", dateStr)
      .maybeSingle()
    
    if (seqCheckError) {
      console.error("[generateInvoiceNumberSupabase] Sequence check error:", {
        error: seqCheckError,
        message: seqCheckError.message,
        code: seqCheckError.code,
        details: seqCheckError.details,
        hint: seqCheckError.hint,
        sequenceKey,
        storeId
      })
      
      // If it's a "not found" error (PGRST116), that's OK - we'll create it
      // If it's RLS error (42501), we need to fix the RLS policy
      if (seqCheckError.code !== 'PGRST116' && seqCheckError.code !== '42P01') {
        if (seqCheckError.code === '42501' || seqCheckError.message.includes('row-level security')) {
          throw new Error(`RLS blocking invoice_sequences access. Run: scripts/fix-invoice-sequences-rls.sql - Error: ${seqCheckError.message}`)
        }
        throw new Error(`Failed to check invoice sequence: ${seqCheckError.message} (Code: ${seqCheckError.code || 'unknown'})`)
      }
    }
    
    let sequence = existingSequence
    
    if (!sequence) {
      // First invoice of the day - create sequence
      // Use upsert to handle race conditions (multiple requests trying to create same sequence)
      const { data: newSequence, error: insertError } = await supabase
        .from("invoice_sequences")
        .upsert({
          id: sequenceKey,
          store_id: storeId,
          date: dateStr,
          sequence: 0,
        }, {
          onConflict: 'id',
          ignoreDuplicates: false, // Update if exists
        })
        .select()
        .single()
      
      if (insertError) {
        console.error("[generateInvoiceNumberSupabase] Sequence upsert error:", {
          error: insertError,
          message: insertError.message,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
          sequenceKey,
          storeId
        })
        
        // If duplicate key error (race condition), retry by fetching existing sequence
        if (insertError.code === '23505' || insertError.message.includes('duplicate key')) {
          console.warn("[generateInvoiceNumberSupabase] Duplicate key detected (race condition), fetching existing sequence")
          const { data: existingSeq, error: fetchError } = await supabase
            .from("invoice_sequences")
            .select("*")
            .eq("id", sequenceKey)
            .single()
          
          if (fetchError || !existingSeq) {
            // If fetch also fails, use timestamp fallback
            console.warn("[generateInvoiceNumberSupabase] Failed to fetch sequence after duplicate key, using timestamp fallback")
            const timestampSeq = Date.now() % 1000
            const seqStr = String(timestampSeq).padStart(3, "0")
            return `${storeCode}-${empId}-${dateStr}${timeStr}-${seqStr}`
          }
          
          sequence = existingSeq
        } else if (insertError.code === '42501' || insertError.message.includes('row-level security')) {
          // If RLS blocks, use fallback sequence
          console.warn("[generateInvoiceNumberSupabase] RLS blocking sequence insert, using timestamp fallback")
          const timestampSeq = Date.now() % 1000
          const seqStr = String(timestampSeq).padStart(3, "0")
          return `${storeCode}-${empId}-${dateStr}${timeStr}-${seqStr}`
        } else {
          throw new Error(`Failed to create invoice sequence: ${insertError.message} (Code: ${insertError.code || 'unknown'})`)
        }
      } else {
        sequence = newSequence
      }
    }
  
    // Increment sequence
    const newSequence = (sequence.sequence || 0) + 1
    if (newSequence > 999) {
      throw new Error("Daily invoice limit reached (999)")
    }
  
    // Update sequence
    const { error: updateError } = await supabase
      .from("invoice_sequences")
      .update({ sequence: newSequence })
      .eq("id", sequenceKey)
    
    if (updateError) {
      console.error("[generateInvoiceNumberSupabase] Sequence update error:", {
        error: updateError,
        message: updateError.message,
        code: updateError.code,
        sequenceKey,
        newSequence
      })
      
      // If update fails due to RLS, use fallback
      if (updateError.code === '42501' || updateError.message.includes('row-level security')) {
        console.warn("[generateInvoiceNumberSupabase] RLS blocking sequence update, using timestamp fallback")
        const timestampSeq = Date.now() % 1000
        const seqStr = String(timestampSeq).padStart(3, "0")
        return `${storeCode}-${empId}-${dateStr}${timeStr}-${seqStr}`
      }
      
      throw new Error(`Failed to update invoice sequence: ${updateError.message} (Code: ${updateError.code || 'unknown'})`)
    }
  
    const seqStr = String(newSequence).padStart(3, "0")
    
    return `${storeCode}-${empId}-${dateStr}${timeStr}-${seqStr}`
  } catch (error) {
    // Better error logging - extract all possible error info
    console.error("[generateInvoiceNumberSupabase] Full error:", error)
    
    let errorMessage = "Unknown error"
    let errorCode = "unknown"
    
    if (error instanceof Error) {
      errorMessage = error.message
      // Try to extract code from message if present
      const codeMatch = errorMessage.match(/Code:\s*([^\s)]+)/)
      if (codeMatch) {
        errorCode = codeMatch[1]
      }
    } else if (error && typeof error === 'object') {
      if ('message' in error) {
        errorMessage = String(error.message)
      }
      if ('code' in error) {
        errorCode = String(error.code)
      } else {
        // Try to stringify the error object to see what's in it
        try {
          const errorStr = JSON.stringify(error)
          if (errorStr !== '{}') {
            errorMessage = errorStr
          }
        } catch {
          // Ignore JSON stringify errors
        }
      }
    } else {
      errorMessage = String(error)
    }
    
    // Log full details
    console.error("[generateInvoiceNumberSupabase] Parsed error details:", {
      message: errorMessage,
      code: errorCode,
      originalError: error,
      storeId,
      employeeId,
      errorType: typeof error,
      errorConstructor: error?.constructor?.name
    })
    
    const finalMessage = errorMessage || `Unknown error: ${String(error)}`
    throw new Error(`Invoice number generation (Supabase) failed: ${finalMessage}${errorCode !== 'unknown' ? ` (Code: ${errorCode})` : ''}`)
  }
}
