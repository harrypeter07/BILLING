// Test Supabase upload using existing client configuration
const { createClient } = require('./lib/supabase/client');

async function testSupabaseUpload() {
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
            console.log('Error details:', JSON.stringify(error, null, 2));
            return null;
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
        
        if (signedUrlError) {
            console.error('❌ Failed to create signed URL:', signedUrlError);
        } else {
            console.log('🔑 Signed URL (valid for 1 hour):');
            console.log(signedUrlData.signedUrl);
            return signedUrlData.signedUrl;
        }
        
        // Test download
        console.log('📥 Testing download...');
        const { data: downloadData, error: downloadError } = await supabase.storage
            .from('invoice-pdfs')
            .download(testFileName);
        
        if (downloadError) {
            console.error('❌ Download failed:', downloadError);
        } else {
            const text = await downloadData.text();
            console.log('✅ Download successful! Content:', text);
        }
        
        return publicUrl;
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
        return null;
    }
}

async function checkBucketInfo() {
    try {
        console.log('🔍 Checking bucket info...');
        const supabase = createClient();
        
        const { data, error } = await supabase.storage.getBucket('invoice-pdfs');
        
        if (error) {
            console.error('❌ Failed to get bucket info:', error);
        } else {
            console.log('✅ Bucket info:', data);
            console.log('Public:', data.public);
        }
    } catch (error) {
        console.error('❌ Error checking bucket:', error);
    }
}

async function main() {
    console.log('🧪 Supabase Storage Test');
    console.log('========================');
    
    await checkBucketInfo();
    console.log('\n');
    
    const url = await testSupabaseUpload();
    
    if (url) {
        console.log('\n🎉 Test completed successfully!');
        console.log('📎 You can access the file at:', url);
    } else {
        console.log('\n❌ Test failed');
    }
}

main().catch(console.error);
