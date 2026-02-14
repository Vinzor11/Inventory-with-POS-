import { Button } from '@/components/ui/button';
import AuthLayout from '@/layouts/auth-layout';
import { Head, router } from '@inertiajs/react';

interface AccountDeactivatedProps {
    message: string;
}

export default function AccountDeactivated({
    message,
}: AccountDeactivatedProps) {
    const handleOk = () => {
        router.visit('/login');
    };

    return (
        <AuthLayout title="Account Deactivated" description="Access has been restricted.">
            <Head title="Account Deactivated" />

            <div className="rounded-lg border border-border bg-card p-5 text-center shadow-sm">
                <p className="text-sm text-muted-foreground">{message}</p>
                <Button className="mt-4 w-full" onClick={handleOk}>
                    OK
                </Button>
            </div>
        </AuthLayout>
    );
}
