import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function createPageUrl(page) {
  const routes = {
    Home: '/',
    Interview: '/interview',
    Feedback: '/feedback',
    Profile: '/profile'
  }
  return routes[page] || '/'
}