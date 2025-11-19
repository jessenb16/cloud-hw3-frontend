// API Gateway URL - Replace with your actual API Gateway URL
const API_GATEWAY_URL = 'YOUR_API_GATEWAY_URL_HERE';
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

    // Validate API Gateway URL
    if (API_GATEWAY_URL === 'YOUR_API_GATEWAY_URL_HERE') {
        showStatus(searchStatus, 'Please configure API_GATEWAY_URL in script.js', 'error');
        return;
    }

    // Disable search button and show loading
    searchBtn.disabled = true;
    showStatus(searchStatus, 'Searching...', 'loading');

    try {
        const response = await fetch(`${API_GATEWAY_URL}/search?q=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Handle response - could be array directly or wrapped in an object
        const photos = Array.isArray(data) ? data : (data.photos || data.results || []);
        
        displayResults(photos);
        
        if (photos.length === 0) {
            showStatus(searchStatus, 'No photos found matching your query', 'error');
        } else {
            showStatus(searchStatus, `Found ${photos.length} photo(s)`, 'success');
        }
    } catch (error) {
        console.error('Search error:', error);
        showStatus(searchStatus, `Search failed: ${error.message}`, 'error');
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

    // Validate API Gateway URL
    if (API_GATEWAY_URL === 'YOUR_API_GATEWAY_URL_HERE') {
        showStatus(uploadStatus, 'Please configure API_GATEWAY_URL in script.js', 'error');
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
        // Read file as binary data
        const fileData = await readFileAsArrayBuffer(file);
        
        // Prepare headers
        const headers = {
            'Content-Type': file.type || 'image/jpeg'
        };
        
        // Add custom labels header if provided
        if (customLabelsHeader) {
            headers['x-amz-meta-customLabels'] = customLabelsHeader;
        }

        const response = await fetch(`${API_GATEWAY_URL}/photos`, {
            method: 'PUT',
            headers: headers,
            body: fileData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
        }

        showStatus(uploadStatus, 'Photo uploaded successfully!', 'success');
        
        // Reset form
        uploadForm.reset();
        
        // Optionally trigger a search to show the new photo
        // You can uncomment this if you want to automatically search after upload
        // searchQuery.value = customLabelsHeader || '';
        // searchForm.dispatchEvent(new Event('submit'));
        
    } catch (error) {
        console.error('Upload error:', error);
        showStatus(uploadStatus, `Upload failed: ${error.message}`, 'error');
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
    if (photo.url) {
        // If URL is provided directly
        photoUrl = photo.url;
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
    
    div.innerHTML = `
        <img src="${photoUrl}" alt="Photo" onerror="this.src='https://via.placeholder.com/250?text=Error+Loading+Image'">
        <div class="photo-info">
            ${timestamp ? `<div style="font-size: 0.8em; color: #999; margin-bottom: 5px;">${escapeHtml(timestamp)}</div>` : ''}
            ${labelsHtml}
        </div>
    `;
    
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

