const API_BASE = '/api'

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('auth_token')
  }

  setToken(token) {
    this.token = token
    if (token) {
      localStorage.setItem('auth_token', token)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    }

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }

    const response = await fetch(url, config)
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Network error' }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    return response.json()
  }

  // Auth methods
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    this.setToken(response.token)
    return response
  }

  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: userData
    })
    this.setToken(response.token)
    return response
  }

  async googleAuth(token) {
    const response = await this.request('/auth/google', {
      method: 'POST',
      body: { token }
    })
    this.setToken(response.token)
    return response
  }

  async logout() {
    this.setToken(null)
  }

  async me() {
    return this.request('/auth/me')
  }

  async updateProfile(data) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: data
    })
  }

  // Questions
  async getQuestions(type = null) {
    const query = type ? `?type=${type}` : ''
    return this.request(`/questions${query}`)
  }

  // Sessions
  async createSession(data) {
    return this.request('/sessions', {
      method: 'POST',
      body: data
    })
  }

  async updateSession(id, data) {
    return this.request(`/sessions/${id}`, {
      method: 'PUT',
      body: data
    })
  }

  async getSessions() {
    return this.request('/sessions')
  }

  async getSession(id) {
    return this.request(`/sessions/${id}`)
  }

  // User Stats
  async getUserStats() {
    return this.request('/stats')
  }

  async updateUserStats(data) {
    return this.request('/stats', {
      method: 'PUT',
      body: data
    })
  }

  // AI Integration
  async generateAIResponse(prompt, schema = null) {
    return this.request('/ai/generate', {
      method: 'POST',
      body: { prompt, schema }
    })
  }
}

export const api = new ApiClient()