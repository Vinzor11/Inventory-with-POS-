import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Database, Download } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Database settings',
        href: '/settings/database',
    },
];

export default function DatabaseSettings() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Database settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Database export"
                        description="Download a SQL dump backup of your current database."
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Database className="h-5 w-5" />
                                Export SQL Dump
                            </CardTitle>
                            <CardDescription>
                                This generates a full SQL backup file that includes table structure and records.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                For security, only admin users can export backups.
                            </p>

                            <Button asChild>
                                <a href="/settings/database/export">
                                    <Download className="mr-2 h-4 w-4" />
                                    Export Database (.sql)
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
