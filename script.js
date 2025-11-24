// API Gateway SDK Client - Replace with your actual API key
const API_KEY = '94MfH0ZkQHMFfbCFTR5YaO8QdjMRHFe1Gy1UQQD9';
const apigClient = apigClientFactory.newClient({
    apiKey: API_KEY
});

// S3 Bucket URL - Replace with your actual S3 bucket URL (for constructing photo URLs)
const S3_BUCKET_URL = 'YOUR_S3_BUCKET_URL_HERE';

// DOM Elements
const searchForm = document.getElementById('searchForm');
const searchQuery = document.getElementById('searchQuery');
const searchBtn = document.getElementById('searchBtn');
const searchStatus = document.getElementById('searchStatus');

const uploadForm = document.getElementById('uploadForm');
const photoFile = document.getElementById('photoFile');
const customLabels = document.getElementById('customLabels');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');

const resultsContainer = document.getElementById('resultsContainer');

// Search functionality
searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const query = searchQuery.value.trim();
    if (!query) {
        showStatus(searchStatus, 'Please enter a search query', 'error');
        return;
    }

    // Disable search button and show loading
    searchBtn.disabled = true;
    showStatus(searchStatus, 'Searching...', 'loading');

    try {
        // Use API Gateway SDK
        const result = await apigClient.searchGet({
            q: query
        }, {}, {});

        // SDK returns result with data in result.data
        const responseData = result.data;
        
        // Debug: Log the full result object to see structure
        console.log('Full API result object:', result);
        console.log('Result.data:', result.data);
        console.log('Result.data type:', typeof result.data);
        
        // Debug: Log the raw response
        console.log('Raw API response:', responseData);
        console.log('Raw API response (stringified):', JSON.stringify(responseData));
        
        // Handle response - could be array directly or wrapped in an object
        const photos = Array.isArray(responseData) ? responseData : (responseData.photos || responseData.results || []);
        
        // Debug: Log extracted photos
        console.log('Extracted photos:', photos);
        console.log('Number of photos:', photos.length);
        if (photos.length > 0) {
            console.log('First photo object:', photos[0]);
            console.log('First photo URL:', photos[0].url);
            console.log('First photo URL type:', typeof photos[0].url);
            console.log('First photo URL length:', photos[0].url?.length);
            
            // More visible debugging - alert if URL exists
            if (photos[0].url) {
                console.log('✅ URL found:', photos[0].url.substring(0, 100) + '...');
            } else {
                console.error('❌ NO URL FOUND in photo object!');
            }
        } else {
            console.warn('⚠️ No photos found in response');
        }
        
        displayResults(photos);
        
        if (photos.length === 0) {
            showStatus(searchStatus, 'No photos found matching your query', 'error');
        } else {
            showStatus(searchStatus, `Found ${photos.length} photo(s)`, 'success');
        }
    } catch (error) {
        console.error('Search error:', error);
        console.error('Error details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            response: error.response?.data,
            config: error.config
        });
        // Extract the actual error message from API Gateway response
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           error.status || 
                           'Unknown error';
        showStatus(searchStatus, `Search failed: ${errorMessage}`, 'error');
        displayResults([]);
    } finally {
        searchBtn.disabled = false;
    }
});

// Upload functionality
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const file = photoFile.files[0];
    if (!file) {
        showStatus(uploadStatus, 'Please select a photo to upload', 'error');
        return;
    }

    // Process custom labels
    const labelsInput = customLabels.value.trim();
    let customLabelsHeader = '';
    
    if (labelsInput) {
        // Split by comma or space, trim each label, filter empty strings
        const labels = labelsInput
            .split(/[,\s]+/)
            .map(label => label.trim())
            .filter(label => label.length > 0);
        
        if (labels.length > 0) {
            customLabelsHeader = labels.join(', ');
        }
    }

    // Disable upload button and show loading
    uploadBtn.disabled = true;
    showStatus(uploadStatus, 'Uploading photo...', 'loading');

    try {
        // Generate objectKey (filename) for S3
        // Use the file name, or generate a unique name if not available
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const objectKey = file.name || `photo-${Date.now()}.${fileExtension}`;
        
        // IMPORTANT: API Gateway integration is configured with contentHandling: CONVERT_TO_BINARY,
        // which means it EXPECTS a base64-encoded string and will decode it to binary before
        // forwarding to S3. So here we send the image as base64 text.
        const fileBase64 = await readFileAsBase64(file);
        
        // Prepare parameters for SDK
        // objectKey is a query parameter, x-amz-meta-customLabels is a header (defined in swagger)
        const params = {
            objectKey: objectKey
        };
        
        // Add custom labels header if provided (only if not empty)
        // The SDK maps this based on swagger definition
        if (customLabelsHeader) {
            params['x-amz-meta-customLabels'] = customLabelsHeader;
        }
        
        // Prepare additional params for Content-Type header
        const additionalParams = {
            headers: {
                'Content-Type': file.type || 'image/jpeg'
            }
        };

        // Use API Gateway SDK for upload - send base64 string as body
        // API Gateway will base64-decode this into binary before calling S3
        const result = await apigClient.photosPut(params, fileBase64, additionalParams);

        showStatus(uploadStatus, 'Photo uploaded successfully!', 'success');
        
        // Reset form
        uploadForm.reset();
        
        // Optionally trigger a search to show the new photo
        // You can uncomment this if you want to automatically search after upload
        // searchQuery.value = customLabelsHeader || '';
        // searchForm.dispatchEvent(new Event('submit'));
        
    } catch (error) {
        console.error('Upload error:', error);
        console.error('Error details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            response: error.response?.data,
            config: error.config
        });
        // Extract the actual error message from API Gateway response
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           error.status || 
                           'Unknown error';
        showStatus(uploadStatus, `Upload failed: ${errorMessage}`, 'error');
    } finally {
        uploadBtn.disabled = false;
    }
});

// Display search results
function displayResults(photos) {
    resultsContainer.innerHTML = '';
    
    if (photos.length === 0) {
        resultsContainer.innerHTML = '<p class="empty-message">No photos found</p>';
        return;
    }

    photos.forEach(photo => {
        const photoItem = createPhotoElement(photo);
        resultsContainer.appendChild(photoItem);
    });
}

// Create a photo element for display
function createPhotoElement(photo) {
    const div = document.createElement('div');
    div.className = 'photo-item';
    
    // Determine photo URL
    let photoUrl = '';
    
    // Debug: Log the photo object structure
    console.log('Photo object in createPhotoElement:', photo);
    console.log('Photo.url value:', photo.url);
    console.log('Photo.url type:', typeof photo.url);
    console.log('Photo.url is truthy:', !!photo.url);
    
    if (photo.url) {
        // If URL is provided directly
        photoUrl = String(photo.url).trim(); // Convert to string and trim
        
        // Check if URL is empty after trimming
        if (!photoUrl) {
            console.error('URL is empty or whitespace only');
            photoUrl = 'https://via.placeholder.com/250?text=No+URL';
        } else {
            // Validate URL format - presigned URLs should start with http:// or https://
            if (!photoUrl.match(/^https?:\/\//)) {
                console.error('Invalid URL format (missing protocol):', photoUrl);
                // Try to fix by adding https://
                if (photoUrl.startsWith('//')) {
                    photoUrl = 'https:' + photoUrl;
                } else if (!photoUrl.includes('://')) {
                    // If it looks like a hostname, add https://
                    photoUrl = 'https://' + photoUrl;
                }
                console.log('Fixed URL:', photoUrl);
            }
        }
    } else if (photo.objectKey && photo.bucket) {
        // Construct URL from bucket and objectKey
        if (S3_BUCKET_URL !== 'YOUR_S3_BUCKET_URL_HERE') {
            // Use configured S3 URL
            const baseUrl = S3_BUCKET_URL.endsWith('/') ? S3_BUCKET_URL : S3_BUCKET_URL + '/';
            photoUrl = baseUrl + encodeURIComponent(photo.objectKey);
        } else {
            // Fallback: construct standard S3 URL
            photoUrl = `https://${photo.bucket}.s3.amazonaws.com/${encodeURIComponent(photo.objectKey)}`;
        }
    } else {
        // Fallback placeholder
        photoUrl = 'https://via.placeholder.com/250?text=Photo';
    }
    
    // Get labels for display
    const labels = photo.labels || [];
    const labelsHtml = labels.length > 0 
        ? `<div class="photo-labels">${labels.map(label => `<span>${escapeHtml(label)}</span>`).join('')}</div>`
        : '';
    
    // Get timestamp for display
    const timestamp = photo.createdTimestamp ? formatTimestamp(photo.createdTimestamp) : '';
    
    // Debug: Log the photo URL being used with detailed info
    console.log('Creating photo element with URL:', photoUrl);
    console.log('URL type:', typeof photoUrl);
    console.log('URL length:', photoUrl?.length);
    console.log('URL starts with http:', photoUrl?.startsWith('http'));
    console.log('URL first 100 chars:', photoUrl?.substring(0, 100));
    console.log('URL last 50 chars:', photoUrl?.substring(Math.max(0, photoUrl.length - 50)));
    
    if (photoUrl) {
        try {
            const urlObj = new URL(photoUrl);
            console.log('Parsed URL - protocol:', urlObj.protocol, 'hostname:', urlObj.hostname);
            console.log('Parsed URL - full hostname:', urlObj.hostname);
            
            // Check if hostname can be resolved (this will help debug ERR_NAME_NOT_RESOLVED)
            if (!urlObj.hostname || urlObj.hostname.length === 0) {
                console.error('ERROR: URL hostname is empty!');
            } else if (urlObj.hostname.includes(' ')) {
                console.error('ERROR: URL hostname contains spaces!', urlObj.hostname);
            }
        } catch (e) {
            console.error('URL parsing failed:', e.message, 'URL:', photoUrl);
            console.error('URL substring around error:', photoUrl?.substring(0, 200));
        }
    }
    
    // Create image element using DOM methods to safely handle URLs
    const img = document.createElement('img');
    console.log('Setting img.src to:', photoUrl);
    console.log('img.src before setting:', img.src);
    img.src = photoUrl;
    console.log('img.src after setting:', img.src);
    console.log('img.src length:', img.src?.length);
    console.log('img.src === photoUrl?', img.src === photoUrl);
    img.alt = 'Photo';
    img.onerror = function() {
        console.error('❌ Image failed to load!');
        console.error('Failed URL:', this.src);
        console.error('Failed URL type:', typeof this.src);
        console.error('Failed URL length:', this.src?.length);
        console.error('Failed URL first 100 chars:', this.src?.substring(0, 100));
        try {
            const failedUrlObj = new URL(this.src);
            console.error('Failed URL hostname:', failedUrlObj.hostname);
        } catch (e) {
            console.error('Failed to parse failed URL:', e.message);
        }
        this.src = 'https://via.placeholder.com/250?text=Error+Loading+Image';
    };
    img.onload = function() {
        console.log('✅ Image loaded successfully!');
        console.log('Loaded URL:', this.src);
    };
    
    // Create info div
    const infoDiv = document.createElement('div');
    infoDiv.className = 'photo-info';
    
    if (timestamp) {
        const timestampDiv = document.createElement('div');
        timestampDiv.style.fontSize = '0.8em';
        timestampDiv.style.color = '#999';
        timestampDiv.style.marginBottom = '5px';
        timestampDiv.textContent = timestamp;
        infoDiv.appendChild(timestampDiv);
    }
    
    if (labels.length > 0) {
        const labelsDiv = document.createElement('div');
        labelsDiv.className = 'photo-labels';
        labels.forEach(label => {
            const labelSpan = document.createElement('span');
            labelSpan.textContent = label;
            labelsDiv.appendChild(labelSpan);
        });
        infoDiv.appendChild(labelsDiv);
    }
    
    div.appendChild(img);
    div.appendChild(infoDiv);
    
    return div;
}

// Helper function to read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

// Helper function to read file as base64 string (without data URL prefix)
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target.result;
            // result will be a data URL like "data:image/jpeg;base64,AAAA..."
            if (typeof result === 'string') {
                const commaIndex = result.indexOf(',');
                if (commaIndex !== -1) {
                    resolve(result.substring(commaIndex + 1));
                    return;
                }
            }
            reject(new Error('Failed to read file as base64'));
        };
        reader.onerror = () => reject(new Error('Failed to read file as base64'));
        reader.readAsDataURL(file);
    });
}

// Helper function to show status messages
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-message show ${type}`;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            element.classList.remove('show');
        }, 5000);
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to format timestamp
function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (e) {
        return timestamp;
    }
}

