# Supabase Database Schema

## Table of Contents
- [1. auth schema](#1-auth-schema)
- [2. public schema](#2-public-schema)
- [3. realtime schema](#3-realtime-schema)
- [4. storage schema](#4-storage-schema)
- [5. Foreign Key Relationships (Summary)](#5-foreign-key-relationships-summary)
- [6. AI Consumption Prompts](#6-ai-consumption-prompts)
- [7. Change Log](#7-change-log)

## 1. auth schema

### `auth.audit_log_entries`
**RLS Enabled**: `true` | **Approx Rows**: `2751`

- **instance_id**: `uuid`
- **id**: `uuid` (PK)
- **payload**: `json`
- **created_at**: `timestamptz`
- **ip_address**: `varchar` (default ''::character varying)

### `auth.custom_oauth_providers`
**RLS Enabled**: `false` | **Approx Rows**: `0`

- **id**: `uuid` (PK, default gen_random_uuid())
- **provider_type**: `text`
- **identifier**: `text`
- **name**: `text`
- **client_id**: `text`
- **client_secret**: `text`
- **acceptable_client_ids**: `_text` (default '{}'::text[])
- **scopes**: `_text` (default '{}'::text[])
- **pkce_enabled**: `bool` (default true)
- **attribute_mapping**: `jsonb` (default '{}'::jsonb)
- **authorization_params**: `jsonb` (default '{}'::jsonb)
- **enabled**: `bool` (default true)
- **email_optional**: `bool` (default false)
- **issuer**: `text`
- **discovery_url**: `text`
- **skip_nonce_check**: `bool` (default false)
- **cached_discovery**: `jsonb`
- **discovery_cached_at**: `timestamptz`
- **authorization_url**: `text`
- **token_url**: `text`
- **userinfo_url**: `text`
- **jwks_uri**: `text`
- **created_at**: `timestamptz` (default now())
- **updated_at**: `timestamptz` (default now())

### `auth.flow_state`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **user_id**: `uuid`
- **auth_code**: `text`
- **code_challenge_method**: `code_challenge_method`
- **code_challenge**: `text`
- **provider_type**: `text`
- **provider_access_token**: `text`
- **provider_refresh_token**: `text`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **authentication_method**: `text`
- **auth_code_issued_at**: `timestamptz`
- **invite_token**: `text`
- **referrer**: `text`
- **oauth_client_state_id**: `uuid`
- **linking_target_id**: `uuid`
- **email_optional**: `bool` (default false)

### `auth.identities`
**RLS Enabled**: `true` | **Approx Rows**: `138`

- **provider_id**: `text`
- **user_id**: `uuid` (FK -> auth.users.id)
- **identity_data**: `jsonb`
- **provider**: `text`
- **last_sign_in_at**: `timestamptz`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **email**: `text` (default lower((identity_data ->> 'email'::text)))
- **id**: `uuid` (PK, default gen_random_uuid())

### `auth.instances`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **uuid**: `uuid`
- **raw_base_config**: `text`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`

### `auth.mfa_amr_claims`
**RLS Enabled**: `true` | **Approx Rows**: `143`

- **session_id**: `uuid` (FK -> auth.sessions.id)
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **authentication_method**: `text`
- **id**: `uuid` (PK)

### `auth.mfa_challenges`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **factor_id**: `uuid` (FK -> auth.mfa_factors.id)
- **created_at**: `timestamptz`
- **verified_at**: `timestamptz`
- **ip_address**: `inet`
- **otp_code**: `text`
- **web_authn_session_data**: `jsonb`

### `auth.mfa_factors`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **user_id**: `uuid` (FK -> auth.users.id)
- **friendly_name**: `text`
- **factor_type**: `factor_type`
- **status**: `factor_status`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **secret**: `text`
- **phone**: `text`
- **last_challenged_at**: `timestamptz`
- **web_authn_credential**: `jsonb`
- **web_authn_aaguid**: `uuid`
- **last_webauthn_challenge_data**: `jsonb`

### `auth.oauth_authorizations`
**RLS Enabled**: `false` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **authorization_id**: `text`
- **client_id**: `uuid` (FK -> auth.oauth_clients.id)
- **user_id**: `uuid` (FK -> auth.users.id)
- **redirect_uri**: `text`
- **scope**: `text`
- **state**: `text`
- **resource**: `text`
- **code_challenge**: `text`
- **code_challenge_method**: `code_challenge_method`
- **response_type**: `oauth_response_type` (default 'code'::auth.oauth_response_type)
- **status**: `oauth_authorization_status` (default 'pending'::auth.oauth_authorization_status)
- **authorization_code**: `text`
- **created_at**: `timestamptz` (default now())
- **expires_at**: `timestamptz` (default (now() + '00:03:00'::interval))
- **approved_at**: `timestamptz`
- **nonce**: `text`

### `auth.oauth_client_states`
**RLS Enabled**: `false` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **provider_type**: `text`
- **code_verifier**: `text`
- **created_at**: `timestamptz`

### `auth.oauth_clients`
**RLS Enabled**: `false` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **client_secret_hash**: `text`
- **registration_type**: `oauth_registration_type`
- **redirect_uris**: `text`
- **grant_types**: `text`
- **client_name**: `text`
- **client_uri**: `text`
- **logo_uri**: `text`
- **created_at**: `timestamptz` (default now())
- **updated_at**: `timestamptz` (default now())
- **deleted_at**: `timestamptz`
- **client_type**: `oauth_client_type` (default 'confidential'::auth.oauth_client_type)
- **token_endpoint_auth_method**: `text`

### `auth.oauth_consents`
**RLS Enabled**: `false` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **user_id**: `uuid` (FK -> auth.users.id)
- **client_id**: `uuid` (FK -> auth.oauth_clients.id)
- **scopes**: `text`
- **granted_at**: `timestamptz` (default now())
- **revoked_at**: `timestamptz`

### `auth.one_time_tokens`
**RLS Enabled**: `true` | **Approx Rows**: `1`

- **id**: `uuid` (PK)
- **user_id**: `uuid` (FK -> auth.users.id)
- **token_type**: `one_time_token_type`
- **token_hash**: `text`
- **relates_to**: `text`
- **created_at**: `timestamp` (default now())
- **updated_at**: `timestamp` (default now())

### `auth.refresh_tokens`
**RLS Enabled**: `true` | **Approx Rows**: `215`

- **instance_id**: `uuid`
- **id**: `int8` (PK, default nextval('auth.refresh_tokens_id_seq'::regclass))
- **token**: `varchar`
- **user_id**: `varchar`
- **revoked**: `bool`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **parent**: `varchar`
- **session_id**: `uuid` (FK -> auth.sessions.id)

### `auth.saml_providers`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **sso_provider_id**: `uuid` (FK -> auth.sso_providers.id)
- **entity_id**: `text`
- **metadata_xml**: `text`
- **metadata_url**: `text`
- **attribute_mapping**: `jsonb`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **name_id_format**: `text`

### `auth.saml_relay_states`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **sso_provider_id**: `uuid` (FK -> auth.sso_providers.id)
- **request_id**: `text`
- **for_email**: `text`
- **redirect_to**: `text`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **flow_state_id**: `uuid` (FK -> auth.flow_state.id)

### `auth.schema_migrations`
**RLS Enabled**: `true` | **Approx Rows**: `4`

- **version**: `varchar` (PK)

### `auth.sessions`
**RLS Enabled**: `true` | **Approx Rows**: `143`

- **id**: `uuid` (PK)
- **user_id**: `uuid` (FK -> auth.users.id)
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **factor_id**: `uuid`
- **aal**: `aal_level`
- **not_after**: `timestamptz`
- **refreshed_at**: `timestamp`
- **user_agent**: `text`
- **ip**: `inet`
- **tag**: `text`
- **oauth_client_id**: `uuid` (FK -> auth.oauth_clients.id)
- **refresh_token_hmac_key**: `text`
- **refresh_token_counter**: `int8`
- **scopes**: `text`

### `auth.sso_domains`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **sso_provider_id**: `uuid` (FK -> auth.sso_providers.id)
- **domain**: `text`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`

### `auth.sso_providers`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK)
- **resource_id**: `text`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **disabled**: `bool`

### `auth.users`
**RLS Enabled**: `true` | **Approx Rows**: `138`

- **instance_id**: `uuid`
- **id**: `uuid` (PK)
- **aud**: `varchar`
- **role**: `varchar`
- **email**: `varchar`
- **encrypted_password**: `varchar`
- **email_confirmed_at**: `timestamptz`
- **invited_at**: `timestamptz`
- **confirmation_token**: `varchar`
- **confirmation_sent_at**: `timestamptz`
- **recovery_token**: `varchar`
- **recovery_sent_at**: `timestamptz`
- **email_change_token_new**: `varchar`
- **email_change**: `varchar`
- **email_change_sent_at**: `timestamptz`
- **last_sign_in_at**: `timestamptz`
- **raw_app_meta_data**: `jsonb`
- **raw_user_meta_data**: `jsonb`
- **is_super_admin**: `bool`
- **created_at**: `timestamptz`
- **updated_at**: `timestamptz`
- **phone**: `text` (default NULL::character varying)
- **phone_confirmed_at**: `timestamptz`
- **phone_change**: `text` (default ''::character varying)
- **phone_change_token**: `varchar` (default ''::character varying)
- **phone_change_sent_at**: `timestamptz`
- **confirmed_at**: `timestamptz` (default LEAST(email_confirmed_at, phone_confirmed_at))
- **email_change_token_current**: `varchar` (default ''::character varying)
- **email_change_confirm_status**: `int2` (default 0)
- **banned_until**: `timestamptz`
- **reauthentication_token**: `varchar` (default ''::character varying)
- **reauthentication_sent_at**: `timestamptz`
- **is_sso_user**: `bool` (default false)
- **deleted_at**: `timestamptz`
- **is_anonymous**: `bool` (default false)

### `auth.webauthn_challenges`
**RLS Enabled**: `false` | **Approx Rows**: `0`

- **id**: `uuid` (PK, default gen_random_uuid())
- **user_id**: `uuid` (FK -> auth.users.id)
- **challenge_type**: `text`
- **session_data**: `jsonb`
- **created_at**: `timestamptz` (default now())
- **expires_at**: `timestamptz`

### `auth.webauthn_credentials`
**RLS Enabled**: `false` | **Approx Rows**: `0`

- **id**: `uuid` (PK, default gen_random_uuid())
- **user_id**: `uuid` (FK -> auth.users.id)
- **credential_id**: `bytea`
- **public_key**: `bytea`
- **attestation_type**: `text` (default ''::text)
- **aaguid**: `uuid`
- **sign_count**: `int8` (default 0)
- **transports**: `jsonb` (default '[]'::jsonb)
- **backup_eligible**: `bool` (default false)
- **backed_up**: `bool` (default false)
- **friendly_name**: `text` (default ''::text)
- **created_at**: `timestamptz` (default now())
- **updated_at**: `timestamptz` (default now())
- **last_used_at**: `timestamptz`

## 2. public schema

### `public.Attendance`
**RLS Enabled**: `true` | **Approx Rows**: `24`

- **id**: `int8` (PK)
- **student_id**: `uuid` (FK -> public.Students.student_id, default gen_random_uuid())
- **record_at**: `timestamptz` (default now())
- **date**: `date`
- **attendance_status**: `text`
- **notes**: `text`
- **recorded_by_user_id**: `uuid` (FK -> public.Teachers.teacher_id, default gen_random_uuid())
- **school_id**: `uuid` (FK -> public.Schools.school_id)
- **subject_id**: `uuid` (FK -> public.Subjects.subject_id)

### `public.Class_Subjects`
**RLS Enabled**: `true` | **Approx Rows**: `3`

- **class_subjects__id**: `uuid` (PK, default gen_random_uuid())
- **created_at**: `timestamptz` (default now())
- **subject_id**: `uuid` (FK -> public.Subjects.subject_id, default gen_random_uuid())
- **class_id**: `int4` (FK -> public.Classes.class_id)
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id)
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Classes`
**RLS Enabled**: `true` | **Approx Rows**: `6`

- **created_at**: `timestamptz` (default now())
- **class_name**: `varchar`
- **section**: `varchar`
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id, default gen_random_uuid())
- **class_id**: `int4` (PK)
- **school_id**: `uuid` (FK -> public.Schools.school_id)
- **students_count**: `int4`

### `public.Curriculum`
**RLS Enabled**: `true` | **Approx Rows**: `10`

- **id**: `uuid` (PK, default gen_random_uuid())
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id)
- **class_id**: `int4` (FK -> public.Classes.class_id)
- **subject_id**: `uuid` (FK -> public.Subjects.subject_id)
- **week**: `text`
- **topic**: `text`
- **sub_topic**: `text`
- **status**: `text` (default 'incomplete'::text)
- **academic_session**: `text`
- **created_at**: `timestamptz` (default now())
- **progress**: `int2`
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Grades`
**RLS Enabled**: `true` | **Approx Rows**: `6`

- **grade_id**: `uuid` (PK, default gen_random_uuid())
- **student_id**: `uuid` (FK -> public.Students.student_id)
- **subject_id**: `uuid` (FK -> public.Subjects.subject_id)
- **score**: `numeric`
- **max_score**: `numeric` (default 100)
- **term**: `text`
- **academic_session**: `text`
- **created_at**: `timestamptz` (default now())
- **assessment_type**: `text`
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id)
- **comment**: `text`
- **class_id**: `int4` (FK -> public.Classes.class_id)
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Grading_Structure`
**RLS Enabled**: `true` | **Approx Rows**: `3`

- **id**: `uuid` (PK, default gen_random_uuid())
- **assessment_name**: `text`
- **max_score**: `int2`
- **term**: `text`
- **academic_session**: `text`
- **created_at**: `timestamptz` (default now())
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Lesson_Notes`
**RLS Enabled**: `true` | **Approx Rows**: `3`

- **note_id**: `uuid` (PK, default gen_random_uuid())
- **created_at**: `timestamptz` (default now())
- **title**: `text`
- **file_url**: `text`
- **subject_id**: `uuid` (FK -> public.Subjects.subject_id)
- **class_id**: `int4` (FK -> public.Classes.class_id)
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id)
- **file_size_kb**: `numeric`
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Parent_Student_Links`
**RLS Enabled**: `true` | **Approx Rows**: `6`

- **link_id**: `uuid` (PK, default gen_random_uuid())
- **parent_id**: `uuid` (FK -> public.Parents.parent_id)
- **student_id**: `uuid` (FK -> public.Students.student_id)
- **relationship**: `text`
- **created_at**: `timestamptz` (default now())
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Parents`
**RLS Enabled**: `true` | **Approx Rows**: `7`

- **parent_id**: `uuid` (PK, default gen_random_uuid())
- **full_name**: `varchar`
- **email**: `varchar`
- **phone_number**: `text`
- **address**: `text`
- **occupation**: `text`
- **created_at**: `timestamptz` (default now())
- **user_id**: `uuid` (FK -> auth.users.id)
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Payment_Items`
**RLS Enabled**: `true` | **Approx Rows**: `1`

- **item_id**: `uuid` (PK, default gen_random_uuid())
- **school_id**: `uuid`
- **item_name**: `varchar`
- **amount**: `numeric`
- **is_compulsory**: `bool` (default false)
- **academic_session**: `text`
- **term**: `text`
- **created_at**: `timestamptz` (default now())
- **category**: `text` (default 'other'::text)
- **description**: `text`
- **is_active**: `bool` (default true)

### `public.School_Admin`
**RLS Enabled**: `true` | **Approx Rows**: `43`

- **admin_id**: `uuid` (PK, default gen_random_uuid())
- **created_at**: `timestamptz` (default now())
- **email**: `varchar`
- **role**: `text`
- **permissions_json**: `jsonb`
- **phone_number**: `text`
- **last_login**: `timestamp`
- **full_name**: `varchar`
- **school_id**: `uuid` (FK -> public.Schools.school_id)
- **setup_completed**: `bool` (default false)
- **setup_steps_json**: `jsonb` (default '{"classes": false, "profile": false, "students": false, "teachers": false}'::jsonb)
- **gender**: `text`

### `public.Schools`
**RLS Enabled**: `true` | **Approx Rows**: `41`

- **school_id**: `uuid` (PK, default gen_random_uuid())
- **school_name**: `varchar`
- **school_logo_url**: `text`
- **bank_name**: `varchar`
- **account_number**: `varchar`
- **bank_code**: `varchar`
- **sub_account_code**: `varchar`
- **commission_rate**: `numeric` (default 1.5)
- **is_active**: `bool` (default true)
- **created_at**: `timestamptz` (default now())
- **subscription_status**: `text` (default 'trial'::text)
- **current_plan**: `text` (default 'basic'::text)
- **subscription_expires_at**: `timestamptz`
- **tier**: `int4` (default 1)
- **current_session**: `varchar`
- **current_term**: `varchar`
- **next_term_start_date**: `date`

### `public.Student_Virtual_Accounts`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK, default gen_random_uuid())
- **student_id**: `uuid` (FK -> public.Students.student_id)
- **account_number**: `varchar`
- **bank_name**: `varchar`
- **account_reference**: `varchar`
- **bank_code**: `varchar`
- **created_at**: `timestamptz` (default now())
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Students`
**RLS Enabled**: `true` | **Approx Rows**: `64`

- **student_id**: `uuid` (PK, default gen_random_uuid())
- **created_at**: `timestamptz` (default now())
- **full_name**: `varchar`
- **date_of_birth**: `date`
- **gender**: `text`
- **admission_date**: `date`
- **profile_picture**: `varchar`
- **total_points**: `int4`
- **class_id**: `int4` (FK -> public.Classes.class_id)
- **school_id**: `uuid` (FK -> public.Schools.school_id)
- **enrollment_status**: `text` (default `'active'::text`) — values: `active`, `graduated`, `withdrawn`, `expelled`
- **status_reason**: `text` — required for `withdrawn` / `expelled` transitions
- **status_changed_at**: `timestamptz` — timestamp of last status change

> **Migration** (run once in Supabase SQL editor):
> ```sql
> ALTER TABLE public."Students"
>   ADD COLUMN enrollment_status TEXT NOT NULL DEFAULT 'active',
>   ADD COLUMN status_reason     TEXT,
>   ADD COLUMN status_changed_at TIMESTAMPTZ;
> ```

### `public.Subject_Allocations`
**RLS Enabled**: `true` | **Approx Rows**: `2`

- **allocation_id**: `uuid` (PK, default gen_random_uuid())
- **subject_id**: `uuid` (FK -> public.Subjects.subject_id)
- **class_id**: `int4` (FK -> public.Classes.class_id)
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id)
- **school_id**: `uuid` (FK -> public.Schools.school_id)
- **created_at**: `timestamptz` (default now())
- **created_by**: `text`
- **academic_year**: `text`
- **term**: `text`

### `public.Subjects`
**RLS Enabled**: `true` | **Approx Rows**: `11`

- **subject_id**: `uuid` (PK, default gen_random_uuid())
- **created_at**: `timestamptz` (default now())
- **subject_name**: `varchar`
- **is_core**: `bool` (default false)
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id)
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Teachers`
**RLS Enabled**: `true` | **Approx Rows**: `10`

- **teacher_id**: `uuid` (PK, default gen_random_uuid())
- **created_at**: `timestamptz` (default now())
- **first_name**: `varchar`
- **email**: `varchar`
- **phone_number**: `varchar`
- **date_hired**: `date`
- **profile_picture**: `varchar`
- **last_name**: `varchar`
- **date_of_birth**: `date`
- **address**: `text`
- **marital_status**: `varchar`
- **trcn_reg_number**: `varchar`
- **gender**: `varchar`
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.Termly_Enrollment`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **enrollment_id**: `uuid` (PK, default gen_random_uuid())
- **student_id**: `uuid` (FK -> public.Students.student_id)
- **school_id**: `uuid` (FK -> public.Schools.school_id)
- **academic_session**: `text`
- **term**: `text`
- **is_active**: `bool` (default true)
- **billing_status**: `text` (default 'pending'::text)
- **created_at**: `timestamptz` (default now())

### `public.academic_events`
**RLS Enabled**: `true` | **Approx Rows**: `5`

- **id**: `int8` (PK)
- **created_at**: `timestamptz` (default now())
- **term_period**: `text`
- **activity_event**: `text`
- **start_date**: `date`
- **end_date**: `date`
- **duration**: `text`
- **remarks**: `text`
- **academic_session**: `text`
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.emergency_contact`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **contact_id**: `int8` (PK)
- **created_at**: `timestamptz` (default now())
- **name**: `varchar`
- **relationship**: `varchar`
- **phone_number**: `varchar`
- **address**: `text`
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id, default gen_random_uuid())
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.profiles`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK, FK -> auth.users.id)
- **role**: `text` (default 'student'::text)
- **updated_at**: `timestamptz` (default now())
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.qualifications`
**RLS Enabled**: `true` | **Approx Rows**: `6`

- **qualification_id**: `int8` (PK)
- **created_at**: `timestamptz` (default now())
- **teacher_id**: `uuid` (default gen_random_uuid())
- **school_name**: `varchar`
- **certificate_name**: `varchar`
- **feild_of_study**: `varchar`
- **graduation_year**: `int4`

### `public.schedule_configs`
**RLS Enabled**: `true` | **Approx Rows**: `4`

- **id**: `uuid` (PK, default extensions.uuid_generate_v4())
- **class_id**: `int4` (FK -> public.Classes.class_id)
- **start_time**: `time`
- **period_duration**: `int4`
- **periods_per_day**: `int4`
- **active_days**: `_text`
- **break_times**: `jsonb`
- **created_at**: `timestamptz` (default now())
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.school_employment`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **employment_id**: `int8` (PK)
- **created_at**: `timestamptz` (default now())
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id, default gen_random_uuid())
- **start_date**: `date`
- **job_title**: `varchar`
- **contract_type**: `varchar`
- **salary**: `numeric`

### `public.student_subject`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **student_subject_id**: `uuid` (PK, default gen_random_uuid())
- **created_at**: `timestamptz` (default now())
- **subject_id**: `uuid` (FK -> public.Subjects.subject_id, default gen_random_uuid())
- **student_id**: `uuid` (FK -> public.Students.student_id, default gen_random_uuid())

### `public.study_materials`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `int4` (PK, default nextval('study_materials_id_seq'::regclass))
- **title**: `varchar`
- **subject**: `varchar`
- **type**: `varchar`
- **description**: `text`
- **file_url**: `text`
- **file_path**: `text`
- **file_size**: `int8`
- **file_type**: `varchar`
- **uploaded_by**: `varchar`
- **uploaded_at**: `timestamptz` (default now())
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.timetable_entries`
**RLS Enabled**: `true` | **Approx Rows**: `1`

- **id**: `uuid` (PK, default extensions.uuid_generate_v4())
- **subject_id**: `uuid` (FK -> public.Subjects.subject_id)
- **class_id**: `int4` (FK -> public.Classes.class_id)
- **day_of_week**: `varchar`
- **start_time**: `time`
- **duration_minutes**: `int4` (default 40)
- **created_at**: `timestamptz` (default now())
- **school_id**: `uuid` (FK -> public.Schools.school_id)

### `public.work_experience`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **experience_id**: `int8` (PK)
- **created_at**: `timestamptz` (default now())
- **teacher_id**: `uuid` (FK -> public.Teachers.teacher_id, default gen_random_uuid())
- **school_name**: `varchar`
- **professional_development**: `text`
- **position_held**: `varchar`
- **duration**: `varchar`
- **total_experience**: `varchar`

## 3. realtime schema

### `realtime.messages`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **topic**: `text`
- **extension**: `text`
- **payload**: `jsonb`
- **event**: `text`
- **private**: `bool` (default false)
- **updated_at**: `timestamp` (default now())
- **inserted_at**: `timestamp` (PK, default now())
- **id**: `uuid` (PK, default gen_random_uuid())

### `realtime.schema_migrations`
**RLS Enabled**: `false` | **Approx Rows**: `3`

- **version**: `int8` (PK)
- **inserted_at**: `timestamp`

### `realtime.subscription`
**RLS Enabled**: `false` | **Approx Rows**: `0`

- **id**: `int8` (PK)
- **subscription_id**: `uuid`
- **entity**: `regclass`
- **filters**: `_user_defined_filter` (default '{}'::realtime.user_defined_filter[])
- **claims**: `jsonb`
- **claims_role**: `regrole` (default realtime.to_regrole((claims ->> 'role'::text)))
- **created_at**: `timestamp` (default timezone('utc'::text, now()))
- **action_filter**: `text` (default '*'::text)

## 4. storage schema

### `storage.buckets`
**RLS Enabled**: `true` | **Approx Rows**: `1`

- **id**: `text` (PK)
- **name**: `text`
- **owner**: `uuid`
- **created_at**: `timestamptz` (default now())
- **updated_at**: `timestamptz` (default now())
- **public**: `bool` (default false)
- **avif_autodetection**: `bool` (default false)
- **file_size_limit**: `int8`
- **allowed_mime_types**: `_text`
- **owner_id**: `text`
- **type**: `buckettype` (default 'STANDARD'::storage.buckettype)

### `storage.buckets_analytics`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **name**: `text`
- **type**: `buckettype` (default 'ANALYTICS'::storage.buckettype)
- **format**: `text` (default 'ICEBERG'::text)
- **created_at**: `timestamptz` (default now())
- **updated_at**: `timestamptz` (default now())
- **id**: `uuid` (PK, default gen_random_uuid())
- **deleted_at**: `timestamptz`

### `storage.buckets_vectors`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `text` (PK)
- **type**: `buckettype` (default 'VECTOR'::storage.buckettype)
- **created_at**: `timestamptz` (default now())
- **updated_at**: `timestamptz` (default now())

### `storage.migrations`
**RLS Enabled**: `true` | **Approx Rows**: `7`

- **id**: `int4` (PK)
- **name**: `varchar`
- **hash**: `varchar`
- **executed_at**: `timestamp` (default CURRENT_TIMESTAMP)

### `storage.objects`
**RLS Enabled**: `true` | **Approx Rows**: `5`

- **id**: `uuid` (PK, default gen_random_uuid())
- **bucket_id**: `text` (FK -> storage.buckets.id)
- **name**: `text`
- **owner**: `uuid`
- **created_at**: `timestamptz` (default now())
- **updated_at**: `timestamptz` (default now())
- **last_accessed_at**: `timestamptz` (default now())
- **metadata**: `jsonb`
- **path_tokens**: `_text` (default string_to_array(name, '/'::text))
- **version**: `text`
- **owner_id**: `text`
- **user_metadata**: `jsonb`

### `storage.s3_multipart_uploads`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `text` (PK)
- **in_progress_size**: `int8` (default 0)
- **upload_signature**: `text`
- **bucket_id**: `text` (FK -> storage.buckets.id)
- **key**: `text`
- **version**: `text`
- **owner_id**: `text`
- **created_at**: `timestamptz` (default now())
- **user_metadata**: `jsonb`

### `storage.s3_multipart_uploads_parts`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `uuid` (PK, default gen_random_uuid())
- **upload_id**: `text` (FK -> storage.s3_multipart_uploads.id)
- **size**: `int8` (default 0)
- **part_number**: `int4`
- **bucket_id**: `text` (FK -> storage.buckets.id)
- **key**: `text`
- **etag**: `text`
- **owner_id**: `text`
- **version**: `text`
- **created_at**: `timestamptz` (default now())

### `storage.vector_indexes`
**RLS Enabled**: `true` | **Approx Rows**: `0`

- **id**: `text` (PK, default gen_random_uuid())
- **name**: `text`
- **bucket_id**: `text` (FK -> storage.buckets_vectors.id)
- **data_type**: `text`
- **dimension**: `int4`
- **distance_metric**: `text`
- **metadata_configuration**: `jsonb`
- **created_at**: `timestamptz` (default now())
- **updated_at**: `timestamptz` (default now())

## 5. Foreign Key Relationships (Summary)
- `public.Subject_Allocations.school_id -> public.Schools.school_id`
- `auth.refresh_tokens.session_id -> auth.sessions.id`
- `auth.identities.user_id -> auth.users.id`
- `public.Class_Subjects.class_id -> public.Classes.class_id`
- `public.Students.school_id -> public.Schools.school_id`
- `auth.mfa_amr_claims.session_id -> auth.sessions.id`
- `storage.objects.bucket_id -> storage.buckets.id`
- `public.Parent_Student_Links.student_id -> public.Students.student_id`
- `auth.saml_providers.sso_provider_id -> auth.sso_providers.id`
- `storage.s3_multipart_uploads_parts.bucket_id -> storage.buckets.id`
- `public.Grades.subject_id -> public.Subjects.subject_id`
- `public.Parent_Student_Links.parent_id -> public.Parents.parent_id`
- `public.academic_events.school_id -> public.Schools.school_id`
- `public.Parents.school_id -> public.Schools.school_id`
- `auth.saml_relay_states.sso_provider_id -> auth.sso_providers.id`
- `public.Classes.teacher_id -> public.Teachers.teacher_id`
- `public.work_experience.teacher_id -> public.Teachers.teacher_id`
- `auth.mfa_factors.user_id -> auth.users.id`
- `public.Attendance.recorded_by_user_id -> public.Teachers.teacher_id`
- `public.profiles.school_id -> public.Schools.school_id`
- `public.student_subject.student_id -> public.Students.student_id`
- `public.Lesson_Notes.subject_id -> public.Subjects.subject_id`
- `public.emergency_contact.teacher_id -> public.Teachers.teacher_id`
- `public.Grades.school_id -> public.Schools.school_id`
- `public.student_subject.subject_id -> public.Subjects.subject_id`
- `public.emergency_contact.school_id -> public.Schools.school_id`
- `auth.oauth_authorizations.user_id -> auth.users.id`
- `public.Subject_Allocations.class_id -> public.Classes.class_id`
- `public.Subjects.teacher_id -> public.Teachers.teacher_id`
- `public.timetable_entries.class_id -> public.Classes.class_id`
- `public.Subject_Allocations.teacher_id -> public.Teachers.teacher_id`
- `auth.sso_domains.sso_provider_id -> auth.sso_providers.id`
- `public.Curriculum.school_id -> public.Schools.school_id`
- `public.Subject_Allocations.subject_id -> public.Subjects.subject_id`
- `public.Termly_Enrollment.student_id -> public.Students.student_id`
- `auth.saml_relay_states.flow_state_id -> auth.flow_state.id`
- `auth.one_time_tokens.user_id -> auth.users.id`
- `auth.sessions.oauth_client_id -> auth.oauth_clients.id`
- `auth.webauthn_challenges.user_id -> auth.users.id`
- `public.Attendance.student_id -> public.Students.student_id`
- `public.Class_Subjects.teacher_id -> public.Teachers.teacher_id`
- `auth.oauth_consents.client_id -> auth.oauth_clients.id`
- `storage.vector_indexes.bucket_id -> storage.buckets_vectors.id`
- `public.schedule_configs.school_id -> public.Schools.school_id`
- `storage.s3_multipart_uploads_parts.upload_id -> storage.s3_multipart_uploads.id`
- `public.Grades.teacher_id -> public.Teachers.teacher_id`
- `public.Curriculum.subject_id -> public.Subjects.subject_id`
- `public.Parent_Student_Links.school_id -> public.Schools.school_id`
- `public.Curriculum.class_id -> public.Classes.class_id`
- `public.Class_Subjects.school_id -> public.Schools.school_id`
- `public.Students.class_id -> public.Classes.class_id`
- `public.timetable_entries.subject_id -> public.Subjects.subject_id`
- `public.schedule_configs.class_id -> public.Classes.class_id`
- `public.Lesson_Notes.school_id -> public.Schools.school_id`
- `storage.s3_multipart_uploads.bucket_id -> storage.buckets.id`
- `public.profiles.id -> auth.users.id`
- `public.Attendance.school_id -> public.Schools.school_id`
- `public.Student_Virtual_Accounts.student_id -> public.Students.student_id`
- `public.Class_Subjects.subject_id -> public.Subjects.subject_id`
- `public.Lesson_Notes.teacher_id -> public.Teachers.teacher_id`
- `public.Classes.school_id -> public.Schools.school_id`
- `auth.sessions.user_id -> auth.users.id`
- `auth.oauth_authorizations.client_id -> auth.oauth_clients.id`
- `public.timetable_entries.school_id -> public.Schools.school_id`
- `public.Student_Virtual_Accounts.school_id -> public.Schools.school_id`
- `public.school_employment.teacher_id -> public.Teachers.teacher_id`
- `auth.mfa_challenges.factor_id -> auth.mfa_factors.id`
- `public.School_Admin.school_id -> public.Schools.school_id`
- `public.Grading_Structure.school_id -> public.Schools.school_id`
- `public.study_materials.school_id -> public.Schools.school_id`
- `auth.webauthn_credentials.user_id -> auth.users.id`
- `public.Grades.student_id -> public.Students.student_id`
- `public.Parents.user_id -> auth.users.id`
- `public.Grades.class_id -> public.Classes.class_id`
- `auth.oauth_consents.user_id -> auth.users.id`
- `public.Teachers.school_id -> public.Schools.school_id`
- `public.Lesson_Notes.class_id -> public.Classes.class_id`
- `public.Curriculum.teacher_id -> public.Teachers.teacher_id`
- `public.Attendance.subject_id -> public.Subjects.subject_id`
- `public.Termly_Enrollment.school_id -> public.Schools.school_id`
- `public.Subjects.school_id -> public.Schools.school_id`

## 6. AI Consumption Prompts
Use the exact column names and types above when constructing SQL or building embeddings.
Primary keys: many tables use UUID primary keys (`gen_random_uuid()`); some use integer identity columns.
RLS: Many auth and storage tables have RLS enabled. When querying as end-users via Supabase client, RLS will filter rows by JWT/auth context.
Example compact prompt snippets (Public Schema):
```
"Attendance(id: int8 PK, student_id: uuid FK->public.Students.student_id, record_at: timestamptz, date: date, attendance_status: text, notes: text, recorded_by_user_id: uuid FK->public.Teachers.teacher_id, school_id: uuid FK->public.Schools.school_id, subject_id: uuid FK->public.Subjects.subject_id)"
"Class_Subjects(class_subjects__id: uuid PK, created_at: timestamptz, subject_id: uuid FK->public.Subjects.subject_id, class_id: int4 FK->public.Classes.class_id, teacher_id: uuid FK->public.Teachers.teacher_id, school_id: uuid FK->public.Schools.school_id)"
"Classes(created_at: timestamptz, class_name: varchar, section: varchar, teacher_id: uuid FK->public.Teachers.teacher_id, class_id: int4 PK, school_id: uuid FK->public.Schools.school_id, students_count: int4)"
"Curriculum(id: uuid PK, teacher_id: uuid FK->public.Teachers.teacher_id, class_id: int4 FK->public.Classes.class_id, subject_id: uuid FK->public.Subjects.subject_id, week: text, topic: text, sub_topic: text, status: text, academic_session: text, created_at: timestamptz, progress: int2, school_id: uuid FK->public.Schools.school_id)"
"Grades(grade_id: uuid PK, student_id: uuid FK->public.Students.student_id, subject_id: uuid FK->public.Subjects.subject_id, score: numeric, max_score: numeric, term: text, academic_session: text, created_at: timestamptz, assessment_type: text, teacher_id: uuid FK->public.Teachers.teacher_id, comment: text, class_id: int4 FK->public.Classes.class_id, school_id: uuid FK->public.Schools.school_id)"
"Grading_Structure(id: uuid PK, assessment_name: text, max_score: int2, term: text, academic_session: text, created_at: timestamptz, school_id: uuid FK->public.Schools.school_id)"
"Lesson_Notes(note_id: uuid PK, created_at: timestamptz, title: text, file_url: text, subject_id: uuid FK->public.Subjects.subject_id, class_id: int4 FK->public.Classes.class_id, teacher_id: uuid FK->public.Teachers.teacher_id, file_size_kb: numeric, school_id: uuid FK->public.Schools.school_id)"
"Parent_Student_Links(link_id: uuid PK, parent_id: uuid FK->public.Parents.parent_id, student_id: uuid FK->public.Students.student_id, relationship: text, created_at: timestamptz, school_id: uuid FK->public.Schools.school_id)"
"Parents(parent_id: uuid PK, full_name: varchar, email: varchar, phone_number: text, address: text, occupation: text, created_at: timestamptz, user_id: uuid FK->auth.users.id, school_id: uuid FK->public.Schools.school_id)"
"Payment_Items(item_id: uuid PK, school_id: uuid, item_name: varchar, amount: numeric, is_compulsory: bool, academic_session: text, term: text, created_at: timestamptz, category: text, description: text, is_active: bool)"
"School_Admin(admin_id: uuid PK, created_at: timestamptz, email: varchar, role: text, permissions_json: jsonb, phone_number: text, last_login: timestamp, full_name: varchar, school_id: uuid FK->public.Schools.school_id, setup_completed: bool, setup_steps_json: jsonb, gender: text)"
"Schools(school_id: uuid PK, school_name: varchar, school_logo_url: text, bank_name: varchar, account_number: varchar, bank_code: varchar, sub_account_code: varchar, commission_rate: numeric, is_active: bool, created_at: timestamptz, subscription_status: text, current_plan: text, subscription_expires_at: timestamptz, tier: int4, current_session: varchar, current_term: varchar, next_term_start_date: date)"
"Student_Virtual_Accounts(id: uuid PK, student_id: uuid FK->public.Students.student_id, account_number: varchar, bank_name: varchar, account_reference: varchar, bank_code: varchar, created_at: timestamptz, school_id: uuid FK->public.Schools.school_id)"
"Students(student_id: uuid PK, created_at: timestamptz, full_name: varchar, date_of_birth: date, gender: text, admission_date: date, profile_picture: varchar, total_points: int4, class_id: int4 FK->public.Classes.class_id, school_id: uuid FK->public.Schools.school_id)"
"Subject_Allocations(allocation_id: uuid PK, subject_id: uuid FK->public.Subjects.subject_id, class_id: int4 FK->public.Classes.class_id, teacher_id: uuid FK->public.Teachers.teacher_id, school_id: uuid FK->public.Schools.school_id, created_at: timestamptz, created_by: text, academic_year: text, term: text)"
"Subjects(subject_id: uuid PK, created_at: timestamptz, subject_name: varchar, is_core: bool, teacher_id: uuid FK->public.Teachers.teacher_id, school_id: uuid FK->public.Schools.school_id)"
"Teachers(teacher_id: uuid PK, created_at: timestamptz, first_name: varchar, email: varchar, phone_number: varchar, date_hired: date, profile_picture: varchar, last_name: varchar, date_of_birth: date, address: text, marital_status: varchar, trcn_reg_number: varchar, gender: varchar, school_id: uuid FK->public.Schools.school_id)"
"Termly_Enrollment(enrollment_id: uuid PK, student_id: uuid FK->public.Students.student_id, school_id: uuid FK->public.Schools.school_id, academic_session: text, term: text, is_active: bool, billing_status: text, created_at: timestamptz)"
"academic_events(id: int8 PK, created_at: timestamptz, term_period: text, activity_event: text, start_date: date, end_date: date, duration: text, remarks: text, academic_session: text, school_id: uuid FK->public.Schools.school_id)"
"emergency_contact(contact_id: int8 PK, created_at: timestamptz, name: varchar, relationship: varchar, phone_number: varchar, address: text, teacher_id: uuid FK->public.Teachers.teacher_id, school_id: uuid FK->public.Schools.school_id)"
"profiles(id: uuid PK FK->auth.users.id, role: text, updated_at: timestamptz, school_id: uuid FK->public.Schools.school_id)"
"qualifications(qualification_id: int8 PK, created_at: timestamptz, teacher_id: uuid, school_name: varchar, certificate_name: varchar, feild_of_study: varchar, graduation_year: int4)"
"schedule_configs(id: uuid PK, class_id: int4 FK->public.Classes.class_id, start_time: time, period_duration: int4, periods_per_day: int4, active_days: _text, break_times: jsonb, created_at: timestamptz, school_id: uuid FK->public.Schools.school_id)"
"school_employment(employment_id: int8 PK, created_at: timestamptz, teacher_id: uuid FK->public.Teachers.teacher_id, start_date: date, job_title: varchar, contract_type: varchar, salary: numeric)"
"student_subject(student_subject_id: uuid PK, created_at: timestamptz, subject_id: uuid FK->public.Subjects.subject_id, student_id: uuid FK->public.Students.student_id)"
"study_materials(id: int4 PK, title: varchar, subject: varchar, type: varchar, description: text, file_url: text, file_path: text, file_size: int8, file_type: varchar, uploaded_by: varchar, uploaded_at: timestamptz, school_id: uuid FK->public.Schools.school_id)"
"timetable_entries(id: uuid PK, subject_id: uuid FK->public.Subjects.subject_id, class_id: int4 FK->public.Classes.class_id, day_of_week: varchar, start_time: time, duration_minutes: int4, created_at: timestamptz, school_id: uuid FK->public.Schools.school_id)"
"work_experience(experience_id: int8 PK, created_at: timestamptz, teacher_id: uuid FK->public.Teachers.teacher_id, school_name: varchar, professional_development: text, position_held: varchar, duration: varchar, total_experience: varchar)"
```

## 7. Change Log
- **2026-03-26**: Synced master schema file with latest MCP DB state (public, auth, storage, realtime schemas included).
