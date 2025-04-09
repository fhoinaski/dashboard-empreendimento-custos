import React from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormReturn, FieldValues, DefaultValues, SubmitHandler } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { z } from 'zod';

interface FormWithLoadingProps<TFormValues extends FieldValues> {
  defaultValues: Partial<TFormValues> | undefined;
  schema: z.ZodType<TFormValues>;
  onSubmit: SubmitHandler<TFormValues>;
  children: (form: UseFormReturn<TFormValues>) => React.ReactNode;
  isLoading?: boolean;
  isSubmitting?: boolean;
  skeletonFields?: number;
}

export function FormWithLoading<TFormValues extends FieldValues>({
  defaultValues,
  schema,
  onSubmit,
  children,
  isLoading = false,
  isSubmitting = false,
  skeletonFields = 5,
}: FormWithLoadingProps<TFormValues>) {
  const form = useForm<TFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as DefaultValues<TFormValues>,
    mode: 'onChange',
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          {Array.from({ length: skeletonFields }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <div className="pt-4">
            <Skeleton className="h-10 w-1/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {children(form)}
      </form>
    </Form>
  );
}
