'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { useTranslation } from '@/lib/i18n/hooks/useTranslation'
import { changeMyCode } from '@/lib/services/me'
import { PasswordInput, SubmitButton, AuthError } from '@/components/auth'

function buildSchema(t: ReturnType<typeof useTranslation>['t']) {
  return z
    .object({
      currentPassword: z.string().min(1, t('auth.changeCode.validationCurrentRequired')),
      newPassword: z.string().min(8, t('auth.changeCode.validationMinLength')),
      confirmPassword: z.string().min(1, t('auth.changeCode.validationMinLength')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      path: ['confirmPassword'],
      message: t('auth.changeCode.validationMismatch'),
    })
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>

interface ChangeCodeFormProps {
  onSuccess: () => void
}

/** Chantier "Équipe" §5 — écran unique affiché tant que `user.must_change_password` est vrai, voir app/change-password/page.tsx. */
function ChangeCodeForm({ onSuccess }: ChangeCodeFormProps) {
  const { t } = useTranslation()
  const [authError, setAuthError] = React.useState<string | null>(null)

  const schema = React.useMemo(() => buildSchema(t), [t])
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = async (values: FormValues) => {
    setAuthError(null)
    try {
      await changeMyCode({
        current_password: values.currentPassword,
        new_password: values.newPassword,
        new_password_confirmation: values.confirmPassword,
      })
      onSuccess()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : t('auth.changeCode.errorGeneric'))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex w-full max-w-[420px] flex-col gap-[18px]">
      <div className="flex flex-col gap-1">
        <h2 className="text-[26px] font-extrabold tracking-[-0.02em] text-[#0E0E1A]">{t('auth.changeCode.title')}</h2>
        <p className="text-[15px] text-[#6B6B7B]">{t('auth.changeCode.subtitle')}</p>
      </div>

      <AuthError>{authError}</AuthError>

      <Controller
        control={control}
        name="currentPassword"
        render={({ field }) => (
          <PasswordInput
            label={t('auth.changeCode.currentCodeLabel')}
            id="change-code-current"
            autoComplete="current-password"
            autoFocus
            error={errors.currentPassword?.message}
            {...field}
          />
        )}
      />
      <Controller
        control={control}
        name="newPassword"
        render={({ field }) => (
          <PasswordInput
            label={t('auth.changeCode.newCodeLabel')}
            id="change-code-new"
            autoComplete="new-password"
            placeholder={t('auth.changeCode.newCodePlaceholder')}
            error={errors.newPassword?.message}
            {...field}
          />
        )}
      />
      <Controller
        control={control}
        name="confirmPassword"
        render={({ field }) => (
          <PasswordInput
            label={t('auth.changeCode.confirmCodeLabel')}
            id="change-code-confirm"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...field}
          />
        )}
      />

      <SubmitButton isSubmitting={isSubmitting} idleLabel={t('auth.changeCode.submitIdle')} busyLabel={t('auth.changeCode.submitBusy')} />
    </form>
  )
}

export { ChangeCodeForm }
export type { ChangeCodeFormProps }
