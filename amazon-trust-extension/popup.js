// Popup script for extension settings
document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const enableRankingCheckbox = document.getElementById('enableRanking');
    const saveButton = document.getElementById('saveSettings');
    const statusDiv = document.getElementById('settingsStatus');

    // Load existing settings
    loadSettings();

    // Save all settings
    saveButton.addEventListener('click', function() {
        saveAllSettings();
    });

    // Handle Enter key in API key input
    apiKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveButton.click();
        }
    });

    // Auto-save ranking setting when changed
    enableRankingCheckbox.addEventListener('change', function() {
        saveRankingSetting();
    });

    function saveAllSettings() {
        const apiKey = apiKeyInput.value.trim();
        const enableRanking = enableRankingCheckbox.checked;
        
        // Validate API key if provided
        if (apiKey && !apiKey.startsWith('sk-')) {
            showStatus('Invalid API key format', 'error');
            return;
        }

        // Save settings to background script
        chrome.runtime.sendMessage({
            action: 'saveSettings',
            settings: {
                apiKey: apiKey || null,
                enableRanking: enableRanking
            }
        }, function(response) {
            if (response && response.success) {
                showStatus('Settings saved successfully!', 'success');
                if (apiKey) {
                    apiKeyInput.value = ''; // Clear input for security
                }
            } else {
                showStatus('Failed to save settings', 'error');
            }
        });
    }

    function saveRankingSetting() {
        const enableRanking = enableRankingCheckbox.checked;
        
        chrome.runtime.sendMessage({
            action: 'saveSetting',
            setting: 'enableRanking',
            value: enableRanking
        });
    }

    function loadSettings() {
        chrome.runtime.sendMessage({ action: 'getSettings' }, function(response) {
            if (response) {
                // Load API key status
                if (response.apiKey) {
                    showStatus('API key is configured', 'success');
                } else {
                    showStatus('API key is required for AI analysis', 'info');
                }
                
                // Load ranking setting (default true if not set)
                enableRankingCheckbox.checked = response.enableRanking !== false;
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