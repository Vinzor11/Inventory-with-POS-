# DateFrom and DateTo Integration Guide

This guide provides comprehensive documentation on how `date_from` and `date_to` fields work in the HR system, including their usage patterns, validation rules, filtering capabilities, and implementation across different modules.

## Table of Contents

1. [Overview](#overview)
2. [Use Cases](#use-cases)
3. [Data Format](#data-format)
4. [Validation Rules](#validation-rules)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Filtering and Querying](#filtering-and-querying)
8. [Usage Patterns by Module](#usage-patterns-by-module)
9. [Integration Examples](#integration-examples)
10. [Best Practices](#best-practices)

---

## Overview

The `date_from` and `date_to` fields are used throughout the HR system for:

- **Date Range Filtering**: Filtering records by date ranges in lists and logs
- **Employee Data**: Storing date ranges for work experience, voluntary work, and learning & development
- **Training Management**: Defining training start and end dates
- **Request Submissions**: Filtering requests by creation date ranges
- **Leave Management**: Defining leave date ranges

### Key Characteristics

- **Format**: `YYYY-MM-DD` (ISO 8601 date format)
- **Type**: String in frontend, Date/Carbon in backend
- **Optional**: `date_to` can be empty (indicates "Present" or ongoing)
- **Validation**: Both dates must not be in the future, and `date_to` must be >= `date_from`

---

## Use Cases

### 1. Employee Data Sections

Used in employee forms for:

- **Work Experience**: Employment start and end dates
- **Voluntary Work**: Service period start and end dates
- **Learning & Development**: Training/development period dates

**Example**:
```typescript
{
  work_experience: [
    {
      position_title: "Software Engineer",
      company_name: "ABC Corp",
      date_from: "2020-01-15",
      date_to: "2022-12-31"  // Empty string means "Present"
    }
  ]
}
```

### 2. Training Management

Used to define training schedules:

- **Training Start Date** (`date_from`): When training begins
- **Training End Date** (`date_to`): When training ends

**Example**:
```php
$training = [
    'training_title' => 'PHP Advanced',
    'date_from' => '2024-01-15',
    'date_to' => '2024-01-20',
];
```

### 3. Filtering and Search

Used as query parameters to filter records by date ranges:

- **Request Submissions**: Filter by creation date
- **Logs**: Filter activity logs by date range
- **Training Applications**: Filter by training dates

**Example**:
```
GET /requests?date_from=2024-01-01&date_to=2024-01-31
```

---

## Data Format

### Frontend Format

- **Input Type**: HTML5 `date` input
- **Value Format**: `YYYY-MM-DD` (e.g., `2024-01-15`)
- **Storage**: String type in React state

```typescript
const [dateFrom, setDateFrom] = useState<string>('');
const [dateTo, setDateTo] = useState<string>('');

// Date input
<input
  type="date"
  value={dateFrom}
  onChange={(e) => setDateFrom(e.target.value)}
/>
```

### Backend Format

- **Database**: Date column type (MySQL `DATE`)
- **PHP**: Carbon/DateTime objects
- **API Response**: ISO date string (`YYYY-MM-DD`)

```php
// Stored as Carbon instance
$training->date_from; // Carbon instance

// Converted to string for API
$training->date_from?->toDateString(); // "2024-01-15"
```

### Date Conversion Utilities

**Frontend Date Formatting**:
```typescript
// Format date for display
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

// Convert date to input format
const toInputDate = (dateString: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
};
```

**Backend Date Formatting**:
```php
// Format for display
$dateFrom = $training->date_from?->format('Y-m-d'); // "2024-01-15"
$dateFrom = $training->date_from?->format('M d, Y'); // "Jan 15, 2024"

// Format for date range display
$inclusiveDates = trim($dateFrom . ($dateTo ? ' to ' . $dateTo : ''));
// Result: "2024-01-15 to 2024-01-20"
```

---

## Validation Rules

### 1. DateNotFuture Rule

Both `date_from` and `date_to` cannot be in the future.

**Backend Implementation** (`app/Rules/DateNotFuture.php`):
```php
class DateNotFuture implements Rule
{
    public function passes($attribute, $value)
    {
        if (empty($value)) {
            return true; // Empty is handled by required validation
        }

        try {
            $date = new \DateTime($value);
            $today = new \DateTime();
            $today->setTime(23, 59, 59); // End of today

            return $date <= $today;
        } catch (\Exception $e) {
            return false; // Invalid date format
        }
    }

    public function message()
    {
        return 'The :attribute cannot be in the future.';
    }
}
```

**Frontend Implementation** (`resources/js/utils/csForm212Validation.ts`):
```typescript
export const validateDateNotFuture = (
  value: string | undefined | null,
  fieldName: string
): string | null => {
  if (!value || value.trim() === '') {
    return null; // Empty is handled by required validation
  }
  
  // Parse date to avoid timezone issues
  const dateParts = value.split('-').map(Number);
  if (dateParts.length !== 3) {
    return 'is not a valid date';
  }
  
  // Create date at local midnight
  const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  
  if (isNaN(date.getTime())) {
    return 'is not a valid date';
  }
  
  // Compare dates - date should not be after today
  if (date > today) {
    return 'cannot be in the future';
  }
  
  return null;
};
```

### 2. DateRange Rule

When both dates are provided, `date_to` must be greater than or equal to `date_from`.

**Backend Implementation** (`app/Rules/DateRange.php`):
```php
class DateRange implements Rule
{
    private $fromDate;

    public function __construct($fromDate)
    {
        $this->fromDate = $fromDate;
    }

    public function passes($attribute, $value)
    {
        if (empty($value) || empty($this->fromDate)) {
            return true; // Empty dates are handled by required validation
        }

        try {
            $from = new \DateTime($this->fromDate);
            $to = new \DateTime($value);

            return $from <= $to;
        } catch (\Exception $e) {
            return false; // Invalid date format
        }
    }

    public function message()
    {
        return 'The :attribute must be after or equal to the "from" date.';
    }
}
```

**Frontend Implementation**:
```typescript
export const validateDateRange = (
  fromDate: string | undefined | null,
  toDate: string | undefined | null,
  fieldName: string
): string | null => {
  if (!fromDate || !toDate) {
    return null; // Empty dates are handled by required validation
  }
  
  // Parse dates - date input values are in YYYY-MM-DD format
  const fromParts = fromDate.split('-').map(Number);
  const toParts = toDate.split('-').map(Number);
  
  if (fromParts.length !== 3 || toParts.length !== 3) {
    return null; // Invalid date format
  }
  
  // Create dates at local midnight (no timezone conversion)
  const from = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
  const to = new Date(toParts[0], toParts[1] - 1, toParts[2]);
  
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return null; // Invalid dates handled elsewhere
  }
  
  // Validate range
  if (to < from) {
    return 'must be after or equal to the "from" date';
  }
  
  return null;
};
```

### 3. Validation Usage

**Backend Validation** (`app/Http/Controllers/EmployeeController.php`):
```php
// Validate work experience dates
if (!empty($work['date_from'])) {
    $validator = Validator::make(
        ['date_from' => $work['date_from']],
        ['date_from' => [new DateNotFuture()]]
    );
    if ($validator->fails()) {
        $errors["work_experience.{$index}.date_from"] = 
            $validator->errors()->first('date_from');
    }
}

if (!empty($work['date_to'])) {
    $validator = Validator::make(
        ['date_to' => $work['date_to']],
        ['date_to' => [new DateNotFuture()]]
    );
    if ($validator->fails()) {
        $errors["work_experience.{$index}.date_to"] = 
            $validator->errors()->first('date_to');
    }
}

// Validate date range
if (!empty($work['date_from']) && !empty($work['date_to'])) {
    $validator = Validator::make(
        ['date_to' => $work['date_to']],
        ['date_to' => [new DateRange($work['date_from'])]]
    );
    if ($validator->fails()) {
        $errors["work_experience.{$index}.date_range"] = 
            $validator->errors()->first('date_to');
    }
}
```

**Frontend Validation**:
```typescript
// Validate work experience dates
if (work.date_from) {
  const dateError = validateDateNotFuture(work.date_from, '');
  if (dateError) {
    formatErrors[`work_experience.${index}.date_from`] = dateError;
  }
}

if (work.date_to) {
  const dateError = validateDateNotFuture(work.date_to, '');
  if (dateError) {
    formatErrors[`work_experience.${index}.date_to`] = dateError;
  }
}

if (work.date_from && work.date_to) {
  const rangeError = validateDateRange(
    work.date_from,
    work.date_to,
    ''
  );
  if (rangeError) {
    formatErrors[`work_experience.${index}.date_range`] = rangeError;
  }
}
```

---

## Backend Implementation

### 1. Controller Query Building

**Example**: Request Submissions Filtering (`app/Http/Controllers/RequestSubmissionController.php`)

```php
protected function buildSubmissionsQuery(Request $request): array
{
    $dateFrom = $request->input('date_from');
    $dateTo = $request->input('date_to');

    $query = RequestSubmission::with([...])
        ->when($dateFrom, fn ($builder) => 
            $builder->whereDate('created_at', '>=', $dateFrom)
        )
        ->when($dateTo, fn ($builder) => 
            $builder->whereDate('created_at', '<=', $dateTo)
        )
        ->orderByDesc('created_at');

    $filters = [
        'date_from' => $dateFrom,
        'date_to' => $dateTo,
        // ... other filters
    ];

    return [$query, $filters];
}
```

### 2. Training Date Filtering

**Example**: Training Controller (`app/Http/Controllers/TrainingController.php`)

```php
public function logs(Request $request)
{
    $dateFrom = $request->input('date_from', '');
    $dateTo = $request->input('date_to', '');

    $history = TrainingApplication::with(['training'])
        ->when($statusFilter === 'Ongoing', function ($query) {
            $query->where('status', 'Signed Up')
                ->whereHas('training', function ($q) {
                    $q->whereDate('date_from', '<=', now())
                      ->whereDate('date_to', '>=', now());
                });
        })
        ->when($statusFilter === 'Completed', function ($query) {
            $query->where(function ($q) {
                $q->whereIn('status', ['Signed Up', 'Approved'])
                  ->whereHas('training', function ($q2) {
                      $q2->whereDate('date_to', '<', now());
                  });
            })->orWhere('status', 'Completed');
        })
        ->get()
        ->map(function (TrainingApplication $application) {
            return [
                'date_from' => $application->training?->date_from?->toDateString(),
                'date_to' => $application->training?->date_to?->toDateString(),
                // ... other fields
            ];
        });

    return Inertia::render('trainings/logs', [
        'entries' => $history,
        'filters' => [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
        ],
    ]);
}
```

### 3. Employee Data Storage

**Example**: Employee Controller (`app/Http/Controllers/EmployeeController.php`)

```php
// Format dates for storage
$dateFrom = $vw->date_from ? $vw->date_from->format('Y-m-d') : '';
$dateTo = $vw->date_to ? $vw->date_to->format('Y-m-d') : '';

// Combine for display
$inclusiveDates = trim($dateFrom . ($dateTo ? ' to ' . $dateTo : ''));

// Store in array
$voluntaryWorkData = [
    'inclusive_dates' => $inclusiveDates,
    'organization_name' => $vw->organization_name,
    'date_from' => $dateFrom,
    'date_to' => $dateTo,
];
```

---

## Frontend Implementation

### 1. State Management

**Example**: Request Index Page (`resources/js/pages/requests/index.tsx`)

```typescript
export default function RequestsIndex({ filters }: RequestIndexProps) {
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');

    const triggerFetch = (params: Record<string, unknown> = {}) => {
        router.get(
            route('requests.index'),
            {
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                ...params,
            },
            {
                preserveState: true,
                replace: true,
                preserveScroll: true,
            },
        );
    };

    const handleDateChange = (key: 'date_from' | 'date_to', value: string) => {
        if (key === 'date_from') {
            setDateFrom(value);
        } else {
            setDateTo(value);
        }
        triggerFetch({ [key]: value || undefined });
    };

    return (
        <div>
            <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateChange('date_from', e.target.value)}
            />
            <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateChange('date_to', e.target.value)}
            />
        </div>
    );
}
```

### 2. Employee Form Fields

**Example**: Employee Create Page (`resources/js/pages/employees/Create.tsx`)

```typescript
<FloatingInput
    label="Date From"
    type="date"
    value={work.date_from || ''}
    onChange={e => updateSection('work_experience', idx, 'date_from', e.target.value)}
    readOnly={isView}
    required
    id={`work-date-from-${idx}`}
    error={getNestedError('work_experience', idx, 'date_from')}
/>
<FloatingInput
    label="Date To"
    type="date"
    value={work.date_to || ''}
    onChange={e => updateSection('work_experience', idx, 'date_to', e.target.value)}
    readOnly={isView}
    helperText="Leave empty if current"
    id={`work-date-to-${idx}`}
    error={
        getNestedError('work_experience', idx, 'date_to') || 
        getNestedError('work_experience', idx, 'date_range')
    }
/>
```

### 3. Client-Side Filtering

**Example**: Logs Page (`resources/js/pages/employees/logs.tsx`)

```typescript
const [dateFrom, setDateFrom] = useState<string>('');
const [dateTo, setDateTo] = useState<string>('');

const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
        const logDate = new Date(log.created_at);
        
        // Date from filter
        const matchesDateFrom = !dateFrom || 
            logDate >= new Date(dateFrom);
        
        // Date to filter (include entire end date)
        const matchesDateTo = !dateTo || 
            logDate <= new Date(dateTo + 'T23:59:59');
        
        return matchesDateFrom && matchesDateTo;
    });
}, [logs, dateFrom, dateTo]);
```

### 4. Training Logs Filtering

**Example**: Training Logs (`resources/js/pages/trainings/logs.tsx`)

```typescript
const filteredEntries = useMemo(() => {
    let filtered = entries;

    // Date from filter
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter((entry) => {
            const entryDate = entry.date_from
                ? new Date(entry.date_from)
                : entry.updated_at
                ? new Date(entry.updated_at)
                : null;
            if (!entryDate) return false;
            entryDate.setHours(0, 0, 0, 0);
            return entryDate >= fromDate;
        });
    }

    // Date to filter
    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter((entry) => {
            const entryDate = entry.date_to
                ? new Date(entry.date_to)
                : entry.date_from
                ? new Date(entry.date_from)
                : entry.updated_at
                ? new Date(entry.updated_at)
                : null;
            if (!entryDate) return false;
            return entryDate <= toDate;
        });
    }

    return filtered;
}, [entries, dateFrom, dateTo]);
```

---

## Filtering and Querying

### 1. Backend Query Patterns

#### Pattern 1: Single Date Filter

```php
// Filter records created on or after date_from
->when($dateFrom, fn ($builder) => 
    $builder->whereDate('created_at', '>=', $dateFrom)
)

// Filter records created on or before date_to
->when($dateTo, fn ($builder) => 
    $builder->whereDate('created_at', '<=', $dateTo)
)
```

#### Pattern 2: Date Range Filter

```php
// Filter records within date range
->when($dateFrom, fn ($builder) => 
    $builder->whereDate('created_at', '>=', $dateFrom)
)
->when($dateTo, fn ($builder) => 
    $builder->whereDate('created_at', '<=', $dateTo)
)
```

#### Pattern 3: Training Status Based on Dates

```php
// Check if training is ongoing (current date is between date_from and date_to)
->whereHas('training', function ($q) {
    $q->whereDate('date_from', '<=', now())
      ->whereDate('date_to', '>=', now());
})

// Check if training has ended (date_to is in the past)
->whereHas('training', function ($q) {
    $q->whereDate('date_to', '<', now());
})
```

### 2. Frontend Filter Patterns

#### Pattern 1: Server-Side Filtering

```typescript
// Send filters to backend
const triggerFetch = () => {
    router.get(
        route('resource.index'),
        {
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
        },
        {
            preserveState: true,
            replace: true,
        }
    );
};
```

#### Pattern 2: Client-Side Filtering

```typescript
// Filter already-loaded data
const filteredData = useMemo(() => {
    return data.filter((item) => {
        const itemDate = new Date(item.created_at);
        
        const matchesFrom = !dateFrom || 
            itemDate >= new Date(dateFrom);
        
        const matchesTo = !dateTo || 
            itemDate <= new Date(dateTo + 'T23:59:59');
        
        return matchesFrom && matchesTo;
    });
}, [data, dateFrom, dateTo]);
```

---

## Usage Patterns by Module

### 1. Employee Module

**Work Experience**:
- `date_from`: Required when work experience record exists
- `date_to`: Optional (empty = "Present")
- Validation: Both must not be in future, `date_to` >= `date_from`

**Voluntary Work**:
- `date_from`: Required when voluntary work record exists
- `date_to`: Optional (empty = "Present")
- Validation: Same as work experience

**Learning & Development**:
- `date_from`: Required when learning record exists
- `date_to`: Optional (empty = "Present")
- Validation: Same as work experience

**Code Location**: `resources/js/pages/employees/Create.tsx`

### 2. Training Module

**Training Schedule**:
- `date_from`: Training start date (required)
- `date_to`: Training end date (required)
- Used to determine training status (Upcoming, Ongoing, Completed)

**Code Location**: 
- Backend: `app/Http/Controllers/TrainingController.php`
- Frontend: `resources/js/pages/trainings/index.tsx`

### 3. Request Submissions Module

**Filtering**:
- `date_from`: Filter requests created on or after this date
- `date_to`: Filter requests created on or before this date
- Applied to `created_at` field

**Code Location**: 
- Backend: `app/Http/Controllers/RequestSubmissionController.php`
- Frontend: `resources/js/pages/requests/index.tsx`

### 4. Logs Module

**Activity Logs**:
- `date_from`: Filter logs on or after this date
- `date_to`: Filter logs on or before this date
- Applied to `created_at` or `updated_at` field

**Code Locations**:
- `resources/js/pages/employees/logs.tsx`
- `resources/js/pages/users/logs.tsx`
- `resources/js/pages/organizational/logs.tsx`
- `resources/js/pages/trainings/logs.tsx`

---

## Integration Examples

### Example 1: Adding Date Filters to a List Page

**Backend Controller**:

```php
public function index(Request $request)
{
    $dateFrom = $request->input('date_from');
    $dateTo = $request->input('date_to');

    $query = Model::query()
        ->when($dateFrom, fn ($builder) => 
            $builder->whereDate('created_at', '>=', $dateFrom)
        )
        ->when($dateTo, fn ($builder) => 
            $builder->whereDate('created_at', '<=', $dateTo)
        )
        ->orderByDesc('created_at');

    $items = $query->paginate(10);

    return Inertia::render('items/index', [
        'items' => $items,
        'filters' => [
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
        ],
    ]);
}
```

**Frontend Component**:

```typescript
export default function ItemsIndex({ items, filters }: ItemsIndexProps) {
    const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters?.date_to ?? '');

    const handleDateChange = (key: 'date_from' | 'date_to', value: string) => {
        if (key === 'date_from') {
            setDateFrom(value);
        } else {
            setDateTo(value);
        }
        
        router.get(
            route('items.index'),
            {
                date_from: key === 'date_from' ? value : dateFrom || undefined,
                date_to: key === 'date_to' ? value : dateTo || undefined,
            },
            {
                preserveState: true,
                replace: true,
            }
        );
    };

    return (
        <div>
            <div className="flex gap-4">
                <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleDateChange('date_from', e.target.value)}
                    placeholder="From Date"
                />
                <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleDateChange('date_to', e.target.value)}
                    placeholder="To Date"
                />
            </div>
            {/* List items */}
        </div>
    );
}
```

### Example 2: Adding Date Range Fields to a Form

**Frontend Form**:

```typescript
const [formData, setFormData] = useState({
    title: '',
    date_from: '',
    date_to: '',
});

const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate dates
    if (formData.date_from && formData.date_to) {
        const from = new Date(formData.date_from);
        const to = new Date(formData.date_to);
        
        if (to < from) {
            toast.error('End date must be after start date');
            return;
        }
    }
    
    post(route('items.store'), formData);
};

return (
    <form onSubmit={handleSubmit}>
        <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
        <input
            type="date"
            value={formData.date_from}
            onChange={(e) => setFormData({ ...formData, date_from: e.target.value })}
            required
        />
        <input
            type="date"
            value={formData.date_to}
            onChange={(e) => setFormData({ ...formData, date_to: e.target.value })}
            min={formData.date_from} // HTML5 validation
        />
        <button type="submit">Submit</button>
    </form>
);
```

**Backend Validation**:

```php
public function store(Request $request)
{
    $validated = $request->validate([
        'title' => 'required|string|max:255',
        'date_from' => ['required', 'date', new DateNotFuture()],
        'date_to' => ['nullable', 'date', new DateNotFuture()],
    ]);

    // Validate date range if both dates provided
    if (!empty($validated['date_from']) && !empty($validated['date_to'])) {
        $validator = Validator::make(
            ['date_to' => $validated['date_to']],
            ['date_to' => [new DateRange($validated['date_from'])]]
        );
        
        if ($validator->fails()) {
            return back()->withErrors($validator)->withInput();
        }
    }

    // Create record
    Item::create($validated);

    return redirect()->route('items.index')
        ->with('success', 'Item created successfully.');
}
```

### Example 3: Displaying Date Ranges

```typescript
const formatDateRange = (from?: string, to?: string): string => {
    if (!from) return '—';
    
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(date);
    };
    
    if (to) {
        return `${formatDate(from)} - ${formatDate(to)}`;
    }
    
    return `${formatDate(from)} - Present`;
};

// Usage
<span>{formatDateRange(item.date_from, item.date_to)}</span>
```

---

## Best Practices

### 1. Date Format Consistency

- **Always use** `YYYY-MM-DD` format for date inputs
- **Store as** date type in database (not string)
- **Convert to** Carbon/DateTime in PHP backend
- **Format for display** only when rendering to user

### 2. Validation

- **Validate both** client-side and server-side
- **Use DateNotFuture** rule for dates that cannot be in future
- **Use DateRange** rule when both dates are provided
- **Show clear error messages** to users

### 3. Optional Date To

- **Allow empty `date_to`** to indicate "Present" or ongoing
- **Display "Present"** when `date_to` is empty
- **Only validate range** when both dates are provided

### 4. Filtering

- **Use `whereDate()`** in Laravel for date comparisons (ignores time)
- **Set hours to 0:0:0** for `date_from` comparisons
- **Set hours to 23:59:59** for `date_to` comparisons (include entire day)
- **Handle timezone issues** by using local midnight dates

### 5. State Management

- **Initialize from filters** prop when available
- **Use `undefined`** instead of empty string when sending to backend
- **Preserve state** during navigation with `preserveState: true`
- **Replace URL** with `replace: true` to avoid history clutter

### 6. User Experience

- **Provide helper text** for optional `date_to` fields ("Leave empty if current")
- **Set `min` attribute** on `date_to` input to `date_from` value
- **Show date range** in readable format (e.g., "Jan 15, 2024 - Jan 20, 2024")
- **Handle empty dates** gracefully (show "—" or "Present")

### 7. Performance

- **Use server-side filtering** for large datasets
- **Use client-side filtering** only for small, already-loaded datasets
- **Debounce** date filter changes if triggering server requests
- **Use `useMemo`** for client-side filtering to avoid recalculations

---

## Common Patterns Summary

### Pattern 1: Required Date From, Optional Date To

```typescript
// Frontend
<FloatingInput
    label="Date From"
    type="date"
    value={item.date_from || ''}
    onChange={e => setData('date_from', e.target.value)}
    required
/>
<FloatingInput
    label="Date To"
    type="date"
    value={item.date_to || ''}
    onChange={e => setData('date_to', e.target.value)}
    helperText="Leave empty if current"
    min={item.date_from} // Prevent selecting date before date_from
/>
```

### Pattern 2: Date Range Filtering

```typescript
// State
const [dateFrom, setDateFrom] = useState(filters?.date_from ?? '');
const [dateTo, setDateTo] = useState(filters?.date_to ?? '');

// Handler
const handleDateChange = (key: 'date_from' | 'date_to', value: string) => {
    if (key === 'date_from') {
        setDateFrom(value);
    } else {
        setDateTo(value);
    }
    triggerFetch({ [key]: value || undefined });
};
```

### Pattern 3: Date Range Validation

```php
// Backend
if (!empty($data['date_from']) && !empty($data['date_to'])) {
    $validator = Validator::make(
        ['date_to' => $data['date_to']],
        ['date_to' => [new DateRange($data['date_from'])]]
    );
    if ($validator->fails()) {
        $errors['date_range'] = $validator->errors()->first('date_to');
    }
}
```

---

## Troubleshooting

### Issue: Dates Not Filtering Correctly

**Problem**: Date filters not working as expected.

**Solutions**:
1. Check timezone handling - use `whereDate()` instead of `where()`
2. Ensure date format is `YYYY-MM-DD`
3. Set proper hours for date comparisons (0:0:0 for from, 23:59:59 for to)

### Issue: Validation Not Working

**Problem**: Date validation rules not being applied.

**Solutions**:
1. Ensure validation rules are imported: `use App\Rules\DateNotFuture;`
2. Check that dates are not empty before validation
3. Verify date format matches expected format

### Issue: Empty Date To Showing as Error

**Problem**: Empty `date_to` being validated when it should be optional.

**Solutions**:
1. Use `nullable` in validation rules
2. Check for empty values before applying DateRange rule
3. Only validate range when both dates are provided

### Issue: Date Display Format Issues

**Problem**: Dates showing in wrong format or timezone.

**Solutions**:
1. Use `toDateString()` for date-only display
2. Parse dates at local midnight to avoid timezone conversion
3. Use `Intl.DateTimeFormat` for consistent formatting

---

## Summary

The `date_from` and `date_to` fields are essential components of the HR system, used for:

- **Employee data**: Work experience, voluntary work, learning & development
- **Training management**: Training schedules and status determination
- **Filtering**: Date range filtering across multiple modules
- **Logs**: Activity log filtering by date ranges

Key points to remember:

- **Format**: Always use `YYYY-MM-DD` format
- **Validation**: Both dates cannot be in future, `date_to` >= `date_from`
- **Optional**: `date_to` can be empty (indicates "Present")
- **Filtering**: Use `whereDate()` for date comparisons, handle timezones properly
- **Display**: Format dates for user-friendly display, show "Present" when `date_to` is empty

For integration into other systems, follow the patterns and examples provided in this guide, ensuring consistent date handling, validation, and user experience across all modules.

