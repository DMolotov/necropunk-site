// Simple client helpers for register/login using fetch
async function apiPost(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

async function registerUser(username, password, confirmPassword) {
  return apiPost('/api/auth/register', { username, password, confirmPassword });
}

async function loginUser(username, password) {
  return apiPost('/api/auth/login', { username, password });
}

// Export for simple direct usage in browser devtools
window.AuthAPI = { registerUser, loginUser };
