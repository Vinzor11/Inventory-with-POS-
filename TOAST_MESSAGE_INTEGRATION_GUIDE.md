# Toast Message Integration Guide

This guide provides comprehensive documentation on how toast messages work in the HR system, including their positioning, styling, and usage patterns across different pages and CRUD operations.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup and Configuration](#setup-and-configuration)
4. [Positioning and Styling](#positioning-and-styling)
5. [Message Types](#message-types)
6. [Usage Patterns by Page](#usage-patterns-by-page)
7. [CRUD Operation Patterns](#crud-operation-patterns)
8. [Integration Examples](#integration-examples)
9. [Best Practices](#best-practices)

---

## Overview

The HR system uses **Sonner** as the toast notification library, wrapped in a custom component called `CustomToast`. Toast messages provide user feedback for various operations including form submissions, data modifications, file operations, and system notifications.

### Key Features

- **Position**: Top-right corner of the viewport
- **Duration**: 4000ms (4 seconds) by default
- **Theme Support**: Automatically adapts to light/dark mode
- **Rich Colors**: Color-coded messages (success, error, warning, info)
- **Non-blocking**: Messages appear without blocking user interaction

---

## Architecture

### Component Structure

```
resources/js/
├── components/
│   ├── custom-toast.tsx          # Main toast wrapper component
│   └── ui/
│       └── sonner.tsx            # Sonner library wrapper with theme support
```

### Core Components

#### 1. CustomToast Component

**Location**: `resources/js/components/custom-toast.tsx`

```typescript
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

export const CustomToast = () => {
    return <Toaster position="top-right" duration={4000} richColors />;
};

export { toast };
```

**Key Properties**:
- `position="top-right"`: Toast appears in the top-right corner
- `duration={4000}`: Messages auto-dismiss after 4 seconds
- `richColors`: Enables color-coded toast types

#### 2. Sonner Wrapper

**Location**: `resources/js/components/ui/sonner.tsx`

```typescript
import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={{
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
      } as React.CSSProperties}
      {...props}
    />
  )
}

export { Toaster }
```

**Key Features**:
- Theme-aware (light/dark mode support)
- Uses CSS custom properties for styling
- Integrates with the application's design system

---

## Setup and Configuration

### Step 1: Import the Toast Component

In each page component, import both the `CustomToast` component and the `toast` function:

```typescript
import { CustomToast, toast } from '@/components/custom-toast';
```

### Step 2: Render CustomToast in JSX

Add the `<CustomToast />` component within your page's JSX, typically near the top of the return statement:

```typescript
return (
  <AppLayout breadcrumbs={breadcrumbs}>
    <Head title="Page Title" />
    <CustomToast />  {/* Add this component */}
    
    {/* Rest of your page content */}
  </AppLayout>
);
```

**Important**: Each page that uses toast messages must include `<CustomToast />` in its render tree. The component is not globally registered.

---

## Positioning and Styling

### Position

- **Location**: Top-right corner of the viewport
- **Fixed Position**: Messages remain in position during page scroll
- **Z-Index**: High z-index to appear above other content

### Visual Styling

#### Color Scheme

The toast system uses four distinct message types with color coding:

1. **Success** (Green)
   - Used for successful operations
   - Example: "Employee created successfully."

2. **Error** (Red)
   - Used for errors and failures
   - Example: "Failed to delete employee"

3. **Warning** (Yellow/Orange)
   - Used for warnings and cautions
   - Example: "File uploaded but no data was extracted."

4. **Info** (Blue)
   - Used for informational messages
   - Example: "Imported data discarded. No changes were applied."

#### Theme Integration

- **Light Mode**: Uses light background with dark text
- **Dark Mode**: Automatically switches to dark theme
- **System Theme**: Follows user's system preference

#### CSS Variables

The toast styling uses CSS custom properties that integrate with the design system:

```css
--normal-bg: var(--popover)           /* Background color */
--normal-text: var(--popover-foreground)  /* Text color */
--normal-border: var(--border)        /* Border color */
```

### Duration

- **Default**: 4000ms (4 seconds)
- **Auto-dismiss**: Messages automatically disappear after the duration
- **Manual Dismiss**: Users can click to dismiss messages early

---

## Message Types

### 1. Success Messages

Used to indicate successful operations.

```typescript
toast.success('Operation completed successfully.');
```

**Common Use Cases**:
- Record created
- Record updated
- Record deleted
- File uploaded
- Data exported
- Form submitted

### 2. Error Messages

Used to indicate errors or failures.

```typescript
toast.error('Operation failed. Please try again.');
```

**Common Use Cases**:
- Validation errors
- Server errors
- Network errors
- Permission denied
- Operation failed

### 3. Warning Messages

Used to indicate warnings or cautions.

```typescript
toast.warning('Warning: Some data may be incomplete.');
```

**Common Use Cases**:
- Partial success
- Data validation warnings
- File format issues
- Import warnings

### 4. Info Messages

Used for informational messages.

```typescript
toast.info('Information: Process completed.');
```

**Common Use Cases**:
- Status updates
- Process notifications
- System information

---

## Usage Patterns by Page

### Index Pages (List Views)

Index pages typically handle:
- Flash messages from backend
- CRUD operations (Create, Update, Delete)
- Restore operations
- Force delete operations
- Export operations

**Example**: `resources/js/pages/offices/index.tsx`

```typescript
// Flash messages from backend
useEffect(() => {
  if (flash?.success) toast.success(flash.success);
  if (flash?.error) toast.error(flash.error);
}, [flash]);

// Create/Update operations
post(routePath, {
  onSuccess: () => {
    // Flash message handled by useEffect
    closeModal();
    refreshTable();
  },
  onError: (error) => {
    if (typeof error?.message === 'string') {
      toast.error(error.message);
    }
  },
});

// Delete operations
router.delete(route, {
  onError: () => toast.error('Failed to delete office'),
});

// Restore operations
router.post(route('offices.restore', id), {}, {
  onError: () => toast.error('Failed to restore office'),
});
```

### Create Pages

Create pages handle form submissions with specific success/error messages.

**Example**: `resources/js/pages/requests/create.tsx`

```typescript
post(route('requests.store', requestType.id), {
  forceFormData: true,
  preserveScroll: true,
  onSuccess: () => {
    toast.success('Request submitted successfully.');
    reset();
  },
  onError: () => toast.error('Please fix the highlighted errors.'),
});
```

### Complex Form Pages

Complex forms (like Employee Create) use multiple toast messages for different validation scenarios.

**Example**: `resources/js/pages/employees/Create.tsx`

```typescript
// Validation errors
toast.error(`Please fill in all required fields: ${validation.missingFields.join(', ')}`);

// Success messages
toast.success('Employee created successfully.');
toast.success('Employee updated successfully.');

// File upload messages
toast.success('CS Form 212 file uploaded successfully. Please review the preview below.');
toast.warning('File uploaded but no data was extracted. Please check the file format.');

// Import messages
toast.success('Imported data applied to form. Validation is now enabled.');
toast.info('Imported data discarded. No changes were applied.');
```

### Log Pages

Log pages typically show export success messages.

**Example**: `resources/js/pages/employees/logs.tsx`

```typescript
toast.success('Employee logs exported to CSV');
```

---

## CRUD Operation Patterns

### Create Operations

#### Pattern 1: Using Flash Messages (Recommended)

```typescript
// Backend returns flash message
post(route('resource.store'), {
  onSuccess: (response) => {
    // Flash message handled by useEffect watching flash prop
    closeModal();
    refreshTable();
  },
  onError: (error) => {
    toast.error(error?.message || 'Failed to create resource.');
  },
});

// In component
useEffect(() => {
  if (flash?.success) toast.success(flash.success);
  if (flash?.error) toast.error(flash.error);
}, [flash]);
```

#### Pattern 2: Direct Toast Messages

```typescript
post(route('resource.store'), {
  onSuccess: (response) => {
    const successMessage = response.props.flash?.success;
    successMessage && toast.success(successMessage);
    closeModal();
  },
  onError: (errors) => {
    const firstError = Object.values(errors)[0];
    if (firstError) {
      const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
      toast.error(errorMessage);
    } else {
      toast.error('Please check the form for errors.');
    }
  },
});
```

#### Pattern 3: Hardcoded Messages

```typescript
post(route('resource.store'), {
  onSuccess: () => {
    toast.success('Resource created successfully.');
    closeModal();
  },
  onError: () => {
    toast.error('Failed to create resource. Please check the form for errors.');
  },
});
```

**Common Create Messages**:
- `"Resource created successfully."`
- `"Request submitted successfully."`
- `"Employee created successfully."`
- `"OAuth client created successfully!"`

### Read Operations

Read operations typically don't show toast messages unless there's an error loading data. However, some pages show success messages for export operations.

**Example**:
```typescript
toast.success('Data exported to CSV');
```

### Update Operations

#### Pattern 1: Using Flash Messages

```typescript
post(route('resource.update', id), {
  onSuccess: (response) => {
    const successMessage = response.props.flash?.success;
    successMessage && toast.success(successMessage);
    closeModal();
    refreshTable();
  },
  onError: (errors) => {
    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast.error(Array.isArray(firstError) ? firstError[0] : firstError);
    } else {
      toast.error('Failed to update resource.');
    }
  },
});
```

#### Pattern 2: Direct Messages

```typescript
post(route('resource.update', id), {
  onSuccess: () => {
    toast.success('Resource updated successfully.');
    closeModal();
  },
  onError: (error) => {
    toast.error(error?.message || 'Failed to update resource.');
  },
});
```

**Common Update Messages**:
- `"Resource updated successfully."`
- `"Employee updated successfully."`
- `"OAuth client updated successfully!"`
- `"Training saved successfully."`

### Delete Operations

#### Soft Delete

```typescript
router.delete(route('resource.destroy', id), {
  preserveScroll: true,
  onSuccess: (response) => {
    const successMessage = response.props.flash?.success;
    successMessage && toast.success(successMessage);
    closeModal();
    refreshTable();
  },
  onError: () => {
    toast.error('Failed to delete resource.');
  },
});
```

#### Restore (Undelete)

```typescript
router.post(route('resource.restore', id), {}, {
  preserveScroll: true,
  onSuccess: () => {
    refreshTable();
    // Flash message handled by useEffect
  },
  onError: () => {
    toast.error('Failed to restore resource.');
  },
});
```

#### Force Delete (Permanent Delete)

```typescript
router.delete(route('resource.force-delete', id), {
  preserveScroll: true,
  onSuccess: (response) => {
    const successMessage = response.props.flash?.success;
    successMessage && toast.success(successMessage);
    refreshTable();
  },
  onError: () => {
    toast.error('Failed to permanently delete resource.');
  },
});
```

**Common Delete Messages**:
- `"Resource deleted successfully."`
- `"Failed to delete resource."`
- `"Failed to restore resource."`
- `"Failed to permanently delete resource."`
- `"OAuth client deleted successfully"`

---

## Integration Examples

### Example 1: Basic Index Page with CRUD

```typescript
import { CustomToast, toast } from '@/components/custom-toast';
import { usePage } from '@inertiajs/react';

export default function ResourceIndex({ resources, flash }) {
  const { flash: pageFlash } = usePage();
  
  // Handle flash messages
  useEffect(() => {
    if (pageFlash?.success) toast.success(pageFlash.success);
    if (pageFlash?.error) toast.error(pageFlash.error);
  }, [pageFlash]);

  const handleCreate = () => {
    post(route('resources.store'), {
      onSuccess: () => {
        closeModal();
        refreshTable();
      },
      onError: (error) => {
        toast.error(error?.message || 'Failed to create resource.');
      },
    });
  };

  const handleUpdate = (id) => {
    post(route('resources.update', id), {
      onSuccess: () => {
        toast.success('Resource updated successfully.');
        closeModal();
        refreshTable();
      },
      onError: () => {
        toast.error('Failed to update resource.');
      },
    });
  };

  const handleDelete = (id) => {
    router.delete(route('resources.destroy', id), {
      onSuccess: () => {
        refreshTable();
      },
      onError: () => {
        toast.error('Failed to delete resource.');
      },
    });
  };

  return (
    <AppLayout>
      <Head title="Resources" />
      <CustomToast />
      
      {/* Page content */}
    </AppLayout>
  );
}
```

### Example 2: Form Submission with Validation

```typescript
import { CustomToast, toast } from '@/components/custom-toast';

export default function CreateForm() {
  const { data, setData, post, processing, errors } = useForm({
    name: '',
    email: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (processing) return;

    post(route('resources.store'), {
      preserveScroll: true,
      onSuccess: () => {
        toast.success('Resource created successfully.');
        reset();
      },
      onError: (errors) => {
        // Show first validation error
        const firstError = Object.values(errors)[0];
        if (firstError) {
          const errorMessage = Array.isArray(firstError) 
            ? firstError[0] 
            : firstError;
          toast.error(errorMessage);
        } else {
          toast.error('Please fix the highlighted errors.');
        }
      },
    });
  };

  return (
    <AppLayout>
      <Head title="Create Resource" />
      <CustomToast />
      
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
      </form>
    </AppLayout>
  );
}
```

### Example 3: File Upload with Multiple Messages

```typescript
import { CustomToast, toast } from '@/components/custom-toast';

const handleFileUpload = async (file) => {
  // Validation
  if (!file) {
    toast.error('Please select a file to upload.');
    return;
  }

  if (!file.type.includes('excel') && !file.type.includes('spreadsheet')) {
    toast.error('Invalid file type. Please upload an Excel file (.xlsx or .xls).');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    toast.error('File size exceeds 10MB limit. Please upload a smaller file.');
    return;
  }

  // Upload
  router.post(route('resources.upload'), formData, {
    onSuccess: (response) => {
      const message = response.data?.message;
      if (message) {
        toast.success(message);
      } else {
        toast.success('File uploaded successfully.');
      }
    },
    onError: (error) => {
      if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error('Failed to upload file. Please try again.');
      }
    },
  });
};
```

### Example 4: Complex Validation with Multiple Toasts

```typescript
const handleSubmit = () => {
  const validation = validateForm(data);
  
  if (validation.hasErrors) {
    // Show specific validation errors
    if (validation.requiredErrors.length > 0) {
      toast.error(
        `Please fill in all required fields: ${validation.requiredErrors.join(', ')}`
      );
    }
    
    if (validation.formatErrors.length > 0) {
      toast.error(
        `Please fix ${validation.formatErrors.length} format validation error(s).`
      );
    }
    
    return;
  }

  // Submit form
  post(route('resources.store'), {
    onSuccess: () => {
      toast.success('Resource created successfully.');
    },
    onError: (errors) => {
      const errorCount = Object.keys(errors).length;
      if (errorCount > 0) {
        const firstError = Object.entries(errors)[0];
        if (firstError) {
          const [field, message] = firstError;
          toast.error(`Validation Error: ${field} - ${message}`);
        }
        
        if (errorCount > 1) {
          toast.error(
            `There are ${errorCount} validation errors. Please fix them before saving.`
          );
        }
      } else {
        toast.error('Failed to create resource. Please check the form for errors.');
      }
    },
  });
};
```

---

## Best Practices

### 1. Message Consistency

- Use consistent message formats across similar operations
- Prefer backend flash messages over hardcoded frontend messages when possible
- Use descriptive, user-friendly messages

### 2. Error Handling

- Always provide specific error messages when possible
- Show validation errors clearly
- Provide actionable feedback (e.g., "Please fix the highlighted errors")

### 3. Success Feedback

- Confirm successful operations immediately
- Use specific messages (e.g., "Employee created successfully" vs "Success")
- Consider showing additional context when helpful

### 4. Component Placement

- Always include `<CustomToast />` in pages that use toast messages
- Place it near the top of the component tree for consistent rendering
- Don't nest it inside conditional renders

### 5. Flash Message Pattern

- Use the flash message pattern for backend-driven messages
- Monitor flash props with `useEffect` for automatic message display
- This ensures messages persist across page navigation

### 6. Validation Messages

- Show validation errors immediately after form submission
- Provide specific field-level feedback when possible
- Use toast for summary errors, inline errors for field-specific issues

### 7. Multiple Messages

- Avoid showing multiple toast messages simultaneously for the same operation
- Consolidate related errors into a single message when possible
- Use warning/info messages for non-critical notifications

### 8. User Experience

- Keep messages concise and clear
- Use appropriate message types (success, error, warning, info)
- Ensure messages are accessible and readable

---

## Common Message Patterns

### Success Messages

```
"[Resource] created successfully."
"[Resource] updated successfully."
"[Resource] deleted successfully."
"[Resource] restored successfully."
"Request submitted successfully."
"File uploaded successfully."
"Data exported to CSV"
```

### Error Messages

```
"Failed to create [resource]."
"Failed to update [resource]."
"Failed to delete [resource]."
"Failed to restore [resource]."
"Failed to permanently delete [resource]."
"Please fix the highlighted errors."
"Please check the form for errors."
"Validation Error: [field] - [message]"
```

### Warning Messages

```
"File uploaded but no data was extracted. Please check the file format."
"Imported data applied. Found [count] validation error(s). Please review and fix them."
```

### Info Messages

```
"Imported data discarded. No changes were applied."
"Import cancelled. No data was applied to the form."
```

---

## Troubleshooting

### Toast Messages Not Appearing

1. **Check Component Import**: Ensure `<CustomToast />` is included in the page
2. **Check Import Statement**: Verify `toast` is imported from `@/components/custom-toast`
3. **Check Console**: Look for JavaScript errors that might prevent execution
4. **Check Theme**: Verify theme provider is set up correctly

### Messages Appearing in Wrong Position

- Position is hardcoded to `"top-right"` in `CustomToast` component
- To change position, modify the `position` prop in `custom-toast.tsx`

### Messages Not Dismissing

- Default duration is 4000ms
- Check if duration is overridden somewhere
- Verify Sonner library is properly installed

### Theme Not Working

- Ensure `next-themes` provider is set up in the app
- Check that theme context is available to the Sonner wrapper
- Verify CSS variables are defined in your theme

---

## Summary

The toast message system in the HR application provides a consistent, user-friendly way to provide feedback for all operations. Key points:

- **Library**: Sonner with custom wrapper
- **Position**: Top-right corner
- **Duration**: 4 seconds
- **Types**: Success, Error, Warning, Info
- **Theme**: Automatic light/dark mode support
- **Pattern**: Component per page, flash message integration
- **Usage**: CRUD operations, form validation, file operations, exports

For integration into other systems, follow the setup steps, use the provided patterns, and maintain consistency with existing message formats.

