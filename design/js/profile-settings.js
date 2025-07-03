document.addEventListener('DOMContentLoaded', () => {
    // Predefined options for select elements
    const timezones = ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
    const locales = ['en-US', 'fr-FR', 'es-ES', 'de-DE'];

    // Helper function to populate select elements
    function populateSelect(id, options, selected) {
        const select = document.getElementById(id);
        select.innerHTML = ''; // Clear existing options
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            if (option === selected) opt.selected = true;
            select.appendChild(opt);
        });
    }

    // Fetch and populate user settings
    async function fetchUserSettings() {
        try {
            const response = await fetch('/api/user-settings', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } // Adjust based on your auth
            });
            if (!response.ok) throw new Error('Failed to fetch user settings');
            const data = await response.json();
            document.getElementById('display-name').value = data.display_name || '';
            document.getElementById('avatar-url').value = data.avatar_url || '';
            populateSelect('timezone', timezones, data.timezone || 'UTC');
            populateSelect('locale', locales, data.locale || 'en-US');
            document.querySelector(`input[name="theme_mode"][value="${data.theme_mode || 'light'}"]`).checked = true;
            document.getElementById('accent-color').value = data.accent_color || '#ffd700';
            document.querySelector(`input[name="font_size"][value="${data.font_size || 'medium'}"]`).checked = true;
            document.querySelector('input[name="notify_email"]').checked = data.notify_email || false;
            document.querySelector('input[name="notify_sms"]').checked = data.notify_sms || false;
            document.querySelector('input[name="notify_push"]').checked = data.notify_push || false;
            document.querySelector(`input[name="digest_frequency"][value="${data.digest_frequency || 'instant'}"]`).checked = true;
            document.getElementById('two-factor').checked = data.two_factor_enabled || false;
        } catch (error) {
            console.error('Error fetching user settings:', error);
            alert('Unable to load user settings');
        }
    }

    // Handle user settings form submission
    async function handleUserSettingsSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
        data.notify_email = formData.has('notify_email');
        data.notify_sms = formData.has('notify_sms');
        data.notify_push = formData.has('notify_push');
        data.two_factor_enabled = formData.has('two_factor_enabled');
        try {
            const response = await fetch('/api/user-settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token') // Adjust based on your auth
                },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                alert('Settings updated successfully');
            } else {
                throw new Error('Failed to update settings');
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('Failed to update settings');
        }
ere    }

    // Fetch and display API keys
    async function fetchApiKeys() {
        try {
            const response = await fetch('/api/api-keys', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            if (!response.ok) throw new Error('Failed to fetch API keys');
            const keys = await response.json();
            const list = document.getElementById('api-keys-list');
            list.innerHTML = '';
            keys.forEach(key => {
                const li = document.createElement('li');
                li.textContent = `API Key: ${key.key} `;
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.onclick = () => deleteApiKey(key.id);
                li.appendChild(deleteBtn);
                list.appendChild(li);
            });
        } catch (error) {
            console.error('Error fetching API keys:', error);
            alert('Unable to load API keys');
        }
    }

    // Add new API key
    async function addApiKey() {
        try {
            const response = await fetch('/api/api-keys', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            if (response.ok) {
                fetchApiKeys(); // Refresh the list
            } else {
                throw new Error('Failed to add API key');
            }
        } catch (error) {
            console.error('Error adding API key:', error);
            alert('Failed to add API key');
        }
    }

    // Delete API key
    async function deleteApiKey(id) {
        try {
            const response = await fetch(`/api/api-keys/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            if (response.ok) {
                fetchApiKeys(); // Refresh the list
            } else {
                throw new Error('Failed to delete API key');
            }
        } catch (error

) {
            console.error('Error deleting API key:', error);
            alert('Failed to delete API key');
        }
    }

    // Fetch and display webhooks
    async function fetchWebhooks() {
        try {
            const response = await fetch('/api/webhooks', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            if (!response.ok) throw new Error('Failed to fetch webhooks');
            const webhooks = await response.json();
            const list = document.getElementById('webhooks-list');
            list.innerHTML = '';
            webhooks.forEach(hook => {
                const li = document.createElement('li');
                li.textContent = `Webhook: ${hook.url} `;
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Delete';
                deleteBtn.onclick = () => deleteWebhook(hook.id);
                li.appendChild(deleteBtn);
                list.appendChild(li);
            });
        } catch (error) {
            console.error('Error fetching webhooks:', error);
            alert('Unable to load webhooks');
        }
    }

    // Add new webhook (placeholder - requires URL input in a real scenario)
    async function addWebhook() {
        try {
            const url = prompt('Enter Webhook URL:');
            if (!url) return;
            const response = await fetch('/api/webhooks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({ url })
            });
            if (response.ok) {
                fetchWebhooks();
            } else {
                throw new Error('Failed to add webhook');
            }
        } catch (error) {
            console.error('Error adding webhook:', error);
            alert('Failed to add webhook');
        }
    }

    // Delete webhook
    async function deleteWebhook(id) {
        try {
            const response = await fetch(`/api/webhooks/${ Repair id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            if (response.ok) {
                fetchWebhooks();
            } else {
                throw new Error('Failed to delete webhook');
            }
        } catch (error) {
            console.error('Error deleting webhook:', error);
            alert('Failed to delete webhook');
        }
    }

    // Fetch and display connected services
    async function fetchConnectedServices() {
        try {
            const response = await fetch('/api/connected-services', {
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            if (!response.ok) throw new Error('Failed to fetch connected services');
            const services = await response.json();
            const list = document.getElementById('services-list');
            list.innerHTML = '';
            services.forEach(service => {
                const li = document.createElement('li');
                li.textContent = `Service: ${service.service_name} `;
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = 'Disconnect';
                deleteBtn.onclick = () => disconnectService(service.id);
                li.appendChild(deleteBtn);
                list.appendChild(li);
            });
        } catch (error) {
            console.error('Error fetching connected services:', error);
            alert('Unable to load connected services');
        }
    }

    // Connect new service (placeholder - requires service selection in a real scenario)
    async function connectService() {
        try {
            const serviceName = prompt('Enter Service Name (e.g., GitHub):');
            if (!serviceName) return;
            const response = await fetch('/api/connected-services', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('token')
                },
                body: JSON.stringify({ service_name: serviceName })
            });
            if (response.ok) {
                fetchConnectedServices();
            } else {
                throw new Error('Failed to connect service');
            }
        } catch (error) {
            console.error('Error connecting service:', error);
            alert('Failed to connect service');
        }
    }

    // Disconnect service
    async function disconnectService(id) {
        try {
            const response = await fetch(`/api/connected-services/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
            });
            if (response.ok) {
                fetchConnectedServices();
            } else {
                throw new Error('Failed to disconnect service');
            }
        } catch (error) {
            console.error('Error disconnecting service:', error);
            alert('Failed to disconnect service');
        }
    }

    // Initialize the page
    fetchUserSettings();
    fetchApiKeys();
    fetchWebhooks();
    fetchConnectedServices();

    // Add event listeners
    document.getElementById('user-settings-form').addEventListener('submit', handleUserSettingsSubmit);
    document.getElementById('add-api-key').addEventListener('click', addApiKey);
    document.getElementById('add-webhook').addEventListener('click', addWebhook);
    document.getElementById('connect-service').addEventListener('click', connectService);
});
