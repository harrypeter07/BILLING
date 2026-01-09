import { createClient } from '@/lib/supabase/client';

export async function GET() {
    try {
        console.log('🚀 Testing Supabase bucket upload...');
        
        const supabase = createClient();
        
        // Create test content
        const testContent = `Test file uploaded at ${new Date().toISOString()}`;
        const testFileName = `test-${Date.now()}.txt`;
        
        console.log(`📝 Uploading test file: ${testFileName}`);
        
        // Upload to invoice-pdfs bucket
        const { data, error } = await supabase.storage
            .from('invoice-pdfs')
            .upload(testFileName, testContent, {
                contentType: 'text/plain',
                upsert: false
            });
        
        if (error) {
            console.error('❌ Upload failed:', error);
            return Response.json({ 
                success: false, 
                error: error.message,
                details: error 
            }, { status: 500 });
        }
        
        console.log('✅ Upload successful!');
        console.log('File data:', data);
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('invoice-pdfs')
            .getPublicUrl(testFileName);
        
        console.log('🔗 Public URL:', publicUrl);
        
        // Create signed URL (should work even with private bucket)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('invoice-pdfs')
            .createSignedUrl(testFileName, 3600); // 1 hour expiry
        
        let signedUrl = null;
        if (signedUrlError) {
            console.error('❌ Failed to create signed URL:', signedUrlError);
        } else {
            console.log('🔑 Signed URL created successfully');
            signedUrl = signedUrlData.signedUrl;
        }
        
        // Test download
        console.log('📥 Testing download...');
        const { data: downloadData, error: downloadError } = await supabase.storage
            .from('invoice-pdfs')
            .download(testFileName);
        
        let downloadSuccess = false;
        if (downloadError) {
            console.error('❌ Download failed:', downloadError);
        } else {
            const text = await downloadData.text();
            console.log('✅ Download successful! Content:', text);
            downloadSuccess = true;
        }
        
        // Check bucket info
        const { data: bucketData, error: bucketError } = await supabase.storage.getBucket('invoice-pdfs');
        let bucketInfo = null;
        if (bucketError) {
            console.error('❌ Failed to get bucket info:', bucketError);
        } else {
            bucketInfo = {
                name: bucketData.name,
                public: bucketData.public,
                fileSizeLimit: bucketData.file_size_limit,
                allowedMimeTypes: bucketData.allowed_mime_types
            };
        }
        
        return Response.json({
            success: true,
            message: 'Supabase upload test completed successfully',
            data: {
                uploadedFile: testFileName,
                publicUrl,
                signedUrl,
                downloadSuccess,
                bucketInfo,
                uploadData: data
            }
        });
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
        return Response.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
