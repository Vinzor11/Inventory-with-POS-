/**
 * Toast utility functions for displaying notifications
 * 
 * This provides a simple API similar to Sonner's toast() function
 * but works with the shadcn/ui Toast component system.
 * 
 * Usage:
 *   import { toast } from '@/lib/toast';
 *   toast.success('Operation completed successfully.');
 *   toast.error('Operation failed.');
 *   toast.warning('Warning message.');
 *   toast.info('Information message.');
 * 
 * Position: Top-right corner (desktop), Bottom (mobile)
 * Duration: 4000ms (4 seconds) by default
 */

import { toastStore } from '@/components/ui/toaster';

export const toast = {
  /**
   * Display a success toast message
   * @param message - The success message to display
   * @param title - Optional title (defaults to "Success")
   */
  success: (message: string, title: string = 'Success') => {
    toastStore.addToast({
      title,
      description: message,
      variant: 'success',
      duration: 4000,
    });
  },

  /**
   * Display an error toast message
   * @param message - The error message to display
   * @param title - Optional title (defaults to "Error")
   */
  error: (message: string, title: string = 'Error') => {
    toastStore.addToast({
      title,
      description: message,
      variant: 'destructive',
      duration: 4000,
    });
  },

  /**
   * Display a warning toast message
   * @param message - The warning message to display
   * @param title - Optional title (defaults to "Warning")
   */
  warning: (message: string, title: string = 'Warning') => {
    toastStore.addToast({
      title,
      description: message,
      variant: 'warning',
      duration: 4000,
    });
  },

  /**
   * Display an info toast message
   * @param message - The info message to display
   * @param title - Optional title (defaults to "Information")
   */
  info: (message: string, title: string = 'Information') => {
    toastStore.addToast({
      title,
      description: message,
      variant: 'default',
      duration: 4000,
    });
  },
};

