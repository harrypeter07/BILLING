const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSupabaseUpload() {
    try {
        console.log('🚀 Testing Supabase bucket upload...');
        
        // Create a test file
        const testContent = `This is a test file uploaded at ${new Date().toISOString()}`;
        const testFileName = `test-${Date.now()}.txt`;
        
        console.log(`📝 Creating test file: ${testFileName}`);
        
        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('invoice-pdfs') // Assuming this is your bucket name
            .upload(testFileName, testContent, {
                contentType: 'text/plain',
                upsert: false
            });
        
        if (error) {
            console.error('❌ Upload failed:', error);
            console.log('Error details:', JSON.stringify(error, null, 2));
            return;
        }
        
        console.log('✅ Upload successful!');
        console.log('File data:', data);
        
        // Get public URL (even if access is restricted, this will show the format)
        const { data: { publicUrl } } = supabase.storage
            .from('invoice-pdfs')
            .getPublicUrl(testFileName);
        
        console.log('🔗 Public URL format:', publicUrl);
        console.log('⚠️  Note: This URL may not be accessible if public access is disabled');
        
        // Try to get signed URL (should work even with private bucket)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('invoice-pdfs')
            .createSignedUrl(testFileName, 3600); // 1 hour expiry
        
        if (signedUrlError) {
            console.error('❌ Failed to create signed URL:', signedUrlError);
        } else {
            console.log('🔑 Signed URL (valid for 1 hour):', signedUrlData.signedUrl);
        }
        
        // Test downloading the file back
        console.log('📥 Testing file download...');
        const { data: downloadData, error: downloadError } = await supabase.storage
            .from('invoice-pdfs')
            .download(testFileName);
        
        if (downloadError) {
            console.error('❌ Download failed:', downloadError);
        } else {
            const downloadedText = await downloadData.text();
            console.log('✅ Download successful!');
            console.log('Downloaded content:', downloadedText);
        }
        
        // List files in bucket
        console.log('📋 Listing files in bucket...');
        const { data: files, error: listError } = await supabase.storage
            .from('invoice-pdfs')
            .list();
        
        if (listError) {
            console.error('❌ Failed to list files:', listError);
        } else {
            console.log('✅ Files in bucket:', files);
        }
        
        // Clean up - delete test file
        console.log('🗑️  Cleaning up test file...');
        const { error: deleteError } = await supabase.storage
            .from('invoice-pdfs')
            .remove([testFileName]);
        
        if (deleteError) {
            console.error('❌ Failed to delete test file:', deleteError);
        } else {
            console.log('✅ Test file cleaned up');
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Check bucket info
async function checkBucketInfo() {
    try {
        console.log('🔍 Checking bucket information...');
        
        const { data, error } = await supabase.storage.getBucket('invoice-pdfs');
        
        if (error) {
            console.error('❌ Failed to get bucket info:', error);
            console.log('This might mean the bucket doesn\'t exist or you don\'t have permission');
        } else {
            console.log('✅ Bucket info:', data);
            console.log('Bucket name:', data.name);
            console.log('Public:', data.public);
            console.log('File size limit:', data.file_size_limit);
            console.log('Allowed mime types:', data.allowed_mime_types);
        }
    } catch (error) {
        console.error('❌ Error checking bucket:', error);
    }
}

async function main() {
    console.log('🧪 Supabase Storage Test Script');
    console.log('=====================================');
    
    await checkBucketInfo();
    console.log('\n');
    await testSupabaseUpload();
    
    console.log('\n🏁 Test completed');
}

main().catch(console.error);
