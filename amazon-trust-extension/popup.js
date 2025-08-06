// Popup script for extension settings
document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('saveApiKey');
    const statusDiv = document.getElementById('apiStatus');

    // Load existing settings
    loadSettings();

    // Save API key
    saveButton.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('Please enter an API key', 'error');
            return;
        }
        
        if (!apiKey.startsWith('sk-')) {
            showStatus('Invalid API key format', 'error');
            return;
        }

        // Save to background script
        chrome.runtime.sendMessage({
            action: 'setApiKey',
            apiKey: apiKey
        }, function(response) {
            if (response && response.success) {
                showStatus('API key saved successfully!', 'success');
                apiKeyInput.value = ''; // Clear input for security
            } else {
                showStatus('Failed to save API key', 'error');
            }
        });
    });

    // Handle Enter key in input
    apiKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveButton.click();
        }
    });

    function loadSettings() {
        chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
            if (response && response.apiKey) {
                showStatus('API key is configured', 'success');
            } else {
                showStatus('API key is required for AI analysis', 'info');
            }
        });
    }

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        // Hide status after 3 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }
});