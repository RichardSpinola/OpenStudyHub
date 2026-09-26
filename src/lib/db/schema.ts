import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestampNow = sql`(unixepoch() * 1000)`;

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(timestampNow),
});

export const shortcuts = sqliteTable("shortcuts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  icon: text("icon"),
  iconStorageName: text("icon_storage_name"),
  iconMimeType: text("icon_mime_type"),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(timestampNow),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(timestampNow),
});

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    displayName: text("display_name").notNull(),
    locale: text("locale", { enum: ["pt-BR", "en"] })
      .notNull()
      .default("pt-BR"),
    shortcutsInitialized: integer("shortcuts_initialized", { mode: "boolean" })
      .notNull()
      .default(false),
    todayWidgetEnabled: integer("today_widget_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    theme: text("theme", { enum: ["dark", "light"] })
      .notNull()
      .default("dark"),
    homeClockEnabled: integer("home_clock_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    homeClockPosition: text("home_clock_position", {
      enum: ["top-left", "top-right", "bottom-left", "bottom-right"],
    })
      .notNull()
      .default("top-right"),
    bio: text("bio").notNull().default(""),
    avatarStorageName: text("avatar_storage_name"),
    avatarMimeType: text("avatar_mime_type"),
    bannerStorageName: text("banner_storage_name"),
    bannerMimeType: text("banner_mime_type"),
    onboardingVersion: integer("onboarding_version").notNull().default(0),
    notificationPreferencesJson: text("notification_preferences_json")
      .notNull()
      .default(
        '{"desktopEnabled":false,"dm":"all","groupDefault":"mentions","audienceDefault":"mentions","mentionsEnabled":true,"repliesEnabled":true}',
      ),
    login: text("login").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "member"] })
      .notNull()
      .default("member"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    passwordChangedAt: integer("password_changed_at", {
      mode: "timestamp_ms",
    })
      .notNull()
      .default(timestampNow),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("users_login_unique").on(table.login),
    index("users_role_active_idx").on(table.role, table.active),
    check(
      "users_display_name_nonempty",
      sql`length(trim(${table.displayName})) > 0`,
    ),
    check("users_login_nonempty", sql`length(trim(${table.login})) > 0`),
    check("users_role_valid", sql`${table.role} in ('admin', 'member')`),
    check("users_locale_valid", sql`${table.locale} in ('pt-BR', 'en')`),
    check("users_theme_valid", sql`${table.theme} in ('dark', 'light')`),
    check(
      "users_clock_position_valid",
      sql`${table.homeClockPosition} in ('top-left', 'top-right', 'bottom-left', 'bottom-right')`,
    ),
  ],
);

export const userHomeAssets = sqliteTable(
  "user_home_assets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    kind: text("kind", { enum: ["background"] }).notNull(),
    storageName: text("storage_name").notNull(),
    mimeType: text("mime_type", {
      enum: ["image/png", "image/jpeg", "image/webp"],
    }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("user_home_assets_owner_kind_unique").on(
      table.ownerUserId,
      table.kind,
    ),
    check("user_home_assets_kind_valid", sql`${table.kind} = 'background'`),
    check(
      "user_home_assets_mime_valid",
      sql`${table.mimeType} in ('image/png', 'image/jpeg', 'image/webp')`,
    ),
    check("user_home_assets_size_valid", sql`${table.sizeBytes} > 0`),
  ],
);

export const userShortcuts = sqliteTable(
  "user_shortcuts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    icon: text("icon"),
    iconStorageName: text("icon_storage_name"),
    iconMimeType: text("icon_mime_type"),
    sortOrder: integer("sort_order").notNull().default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("user_shortcuts_user_order_idx").on(
      table.userId,
      table.sortOrder,
      table.id,
    ),
  ],
);

export const googleConnections = sqliteTable(
  "google_connections",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    googleSubject: text("google_subject").notNull(),
    accountEmail: text("account_email"),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    grantedScopes: text("granted_scopes").notNull(),
    status: text("status", { enum: ["connected", "revoked"] })
      .notNull()
      .default("connected"),
    driveRootFolderId: text("drive_root_folder_id"),
    connectedAt: integer("connected_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("google_connections_subject_unique").on(table.googleSubject),
    check(
      "google_connections_status_valid",
      sql`${table.status} in ('connected', 'revoked')`,
    ),
  ],
);

export const googleOauthStates = sqliteTable(
  "google_oauth_states",
  {
    stateHash: text("state_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    encryptedCodeVerifier: text("encrypted_code_verifier").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("google_oauth_states_user_idx").on(table.userId),
    index("google_oauth_states_expiry_idx").on(table.expiresAt),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tokenHash: text("token_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expiry_idx").on(table.expiresAt),
    check(
      "sessions_expiry_after_creation",
      sql`${table.expiresAt} > ${table.createdAt}`,
    ),
  ],
);

export const loginRateLimits = sqliteTable("login_rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  failedCount: integer("failed_count").notNull().default(0),
  windowStartedAt: integer("window_started_at", { mode: "timestamp_ms" })
    .notNull()
    .default(timestampNow),
  blockedUntil: integer("blocked_until", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(timestampNow),
});

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    summary: text("summary"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("audit_events_actor_time_idx").on(table.actorUserId, table.createdAt),
    index("audit_events_target_idx").on(table.targetType, table.targetId),
    index("audit_events_time_idx").on(table.createdAt),
    check(
      "audit_events_action_nonempty",
      sql`length(trim(${table.action})) > 0`,
    ),
    check(
      "audit_events_target_type_nonempty",
      sql`length(trim(${table.targetType})) > 0`,
    ),
  ],
);

export const subjects = sqliteTable(
  "subjects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code"),
    name: text("name").notNull(),
    shortName: text("short_name"),
    // Phase 0 compatibility fields. New academic relations use subject_offerings.
    legacyProgram: text("program"),
    legacySemester: text("semester"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("subjects_active_name_idx").on(table.active, table.name),
    index("subjects_code_idx").on(table.code),
  ],
);

export const programs = sqliteTable(
  "programs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code"),
    name: text("name").notNull(),
    shortName: text("short_name"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("programs_code_unique").on(table.code),
    index("programs_active_name_idx").on(table.active, table.name),
    check("programs_name_nonempty", sql`length(trim(${table.name})) > 0`),
  ],
);

export const cohorts = sqliteTable(
  "cohorts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    code: text("code"),
    name: text("name").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("cohorts_program_active_idx").on(
      table.programId,
      table.active,
      table.name,
    ),
    uniqueIndex("cohorts_program_code_unique").on(table.programId, table.code),
    check("cohorts_name_nonempty", sql`length(trim(${table.name})) > 0`),
  ],
);

export const moderatorProgramScopes = sqliteTable(
  "moderator_program_scopes",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.programId] }),
    index("moderator_program_scopes_program_idx").on(table.programId),
  ],
);

export const curatorCohortScopes = sqliteTable(
  "curator_cohort_scopes",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    cohortId: integer("cohort_id")
      .notNull()
      .references(() => cohorts.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.cohortId] }),
    index("curator_cohort_scopes_cohort_idx").on(table.cohortId),
  ],
);

export const userAcademicMemberships = sqliteTable(
  "user_academic_memberships",
  {
    userId: integer("user_id")
      .primaryKey()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    cohortId: integer("cohort_id").references(() => cohorts.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("user_academic_memberships_program_idx").on(table.programId),
    index("user_academic_memberships_cohort_idx").on(table.cohortId),
  ],
);

export const instructors = sqliteTable(
  "instructors",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code"),
    name: text("name").notNull(),
    displayName: text("display_name"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("instructors_code_unique").on(table.code),
    index("instructors_active_name_idx").on(table.active, table.name),
    check("instructors_name_nonempty", sql`length(trim(${table.name})) > 0`),
  ],
);

export const academicPeriods = sqliteTable(
  "academic_periods",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    label: text("label").notNull(),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("academic_periods_label_unique").on(table.label),
    index("academic_periods_dates_idx").on(table.startsOn, table.endsOn),
    check(
      "academic_periods_label_nonempty",
      sql`length(trim(${table.label})) > 0`,
    ),
    check(
      "academic_periods_date_order",
      sql`${table.startsOn} <= ${table.endsOn}`,
    ),
  ],
);

export const locations = sqliteTable(
  "locations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    campus: text("campus"),
    building: text("building"),
    room: text("room"),
    description: text("description"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("locations_active_name_idx").on(table.active, table.name),
    check("locations_name_nonempty", sql`length(trim(${table.name})) > 0`),
  ],
);

export const subjectOfferings = sqliteTable(
  "subject_offerings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    academicPeriodId: integer("academic_period_id")
      .notNull()
      .references(() => academicPeriods.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    instructorId: integer("instructor_id").references(() => instructors.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    classGroup: text("class_group"),
    curriculumTerm: text("curriculum_term"),
    status: text("status", {
      enum: ["planned", "active", "completed", "cancelled"],
    })
      .notNull()
      .default("planned"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("subject_offerings_subject_idx").on(table.subjectId),
    index("subject_offerings_program_period_idx").on(
      table.programId,
      table.academicPeriodId,
    ),
    index("subject_offerings_instructor_idx").on(table.instructorId),
    check(
      "subject_offerings_status_valid",
      sql`${table.status} in ('planned', 'active', 'completed', 'cancelled')`,
    ),
  ],
);

export const offeringGoogleIntegrations = sqliteTable(
  "offering_google_integrations",
  {
    offeringId: integer("offering_id")
      .primaryKey()
      .references(() => subjectOfferings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    driveFolderId: text("drive_folder_id"),
    driveFolderName: text("drive_folder_name"),
    driveStorageUserId: integer("drive_storage_user_id").references(
      () => users.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    notebookUrl: text("notebook_url"),
    classroomCourseId: text("classroom_course_id"),
    classroomCourseName: text("classroom_course_name"),
    updatedByUserId: integer("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("offering_google_drive_folder_idx").on(table.driveFolderId),
    index("offering_google_drive_storage_user_idx").on(
      table.driveStorageUserId,
    ),
    index("offering_google_classroom_course_idx").on(table.classroomCourseId),
  ],
);

export const enrollments = sqliteTable(
  "enrollments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    offeringId: integer("offering_id")
      .notNull()
      .references(() => subjectOfferings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("enrollments_user_offering_unique").on(
      table.userId,
      table.offeringId,
    ),
    index("enrollments_offering_idx").on(table.offeringId),
  ],
);

export const activities = sqliteTable(
  "activities",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    offeringId: integer("offering_id")
      .notNull()
      .references(() => subjectOfferings.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    title: text("title").notNull(),
    description: text("description"),
    dueAt: integer("due_at", { mode: "timestamp_ms" }),
    status: text("status", {
      enum: ["pending", "in_progress", "completed", "submitted", "archived"],
    })
      .notNull()
      .default("pending"),
    origin: text("origin", { enum: ["local", "external"] })
      .notNull()
      .default("local"),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    externalUpdatedAt: integer("external_updated_at", {
      mode: "timestamp_ms",
    }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("activities_user_status_due_idx").on(
      table.userId,
      table.status,
      table.dueAt,
    ),
    index("activities_offering_idx").on(table.offeringId),
    uniqueIndex("activities_external_identity_unique").on(
      table.userId,
      table.externalSource,
      table.externalId,
    ),
    check("activities_title_nonempty", sql`length(trim(${table.title})) > 0`),
    check(
      "activities_status_valid",
      sql`${table.status} in ('pending', 'in_progress', 'completed', 'submitted', 'archived')`,
    ),
    check(
      "activities_origin_valid",
      sql`${table.origin} in ('local', 'external')`,
    ),
    check(
      "activities_external_source_valid",
      sql`${table.externalSource} is null or ${table.externalSource} = 'classroom'`,
    ),
    check(
      "activities_external_identity_valid",
      sql`(${table.origin} = 'local' and ${table.externalSource} is null and ${table.externalId} is null) or (${table.origin} = 'external' and ((${table.externalSource} is null and ${table.externalId} is null) or (${table.externalSource} is not null and ${table.externalId} is not null)))`,
    ),
  ],
);

export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    offeringId: integer("offering_id").references(() => subjectOfferings.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    activityId: integer("activity_id").references(() => activities.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    driveFileId: text("drive_file_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("notes_owner_updated_idx").on(table.ownerUserId, table.updatedAt),
    index("notes_owner_offering_idx").on(table.ownerUserId, table.offeringId),
    index("notes_owner_activity_idx").on(table.ownerUserId, table.activityId),
    check("notes_title_nonempty", sql`length(trim(${table.title})) > 0`),
  ],
);

export const documentTemplates = sqliteTable(
  "document_templates",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    storageUserId: integer("storage_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    baseTemplateId: integer("base_template_id").references(
      (): AnySQLiteColumn => documentTemplates.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    name: text("name").notNull(),
    description: text("description"),
    categoryKind: text("category_kind", {
      enum: ["activity", "notes", "documents", "custom"],
    })
      .notNull()
      .default("documents"),
    sourceFileId: text("source_file_id").notNull(),
    namingPattern: text("naming_pattern").notNull(),
    destinationStrategy: text("destination_strategy", {
      enum: ["offering_drive_folder"],
    })
      .notNull()
      .default("offering_drive_folder"),
    requiredPlaceholders: text("required_placeholders").notNull().default("[]"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("document_templates_owner_active_idx").on(
      table.ownerUserId,
      table.active,
      table.name,
    ),
    index("document_templates_storage_user_idx").on(table.storageUserId),
    check(
      "document_templates_name_nonempty",
      sql`length(trim(${table.name})) > 0`,
    ),
    check(
      "document_templates_source_nonempty",
      sql`length(trim(${table.sourceFileId})) > 0`,
    ),
    check(
      "document_templates_category_valid",
      sql`${table.categoryKind} in ('activity', 'notes', 'documents', 'custom')`,
    ),
    check(
      "document_templates_destination_valid",
      sql`${table.destinationStrategy} = 'offering_drive_folder'`,
    ),
  ],
);

export const documentTemplateSections = sqliteTable(
  "document_template_sections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    templateId: integer("template_id")
      .notNull()
      .references(() => documentTemplates.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    internalKey: text("internal_key").notNull(),
    displayTitle: text("display_title").notNull(),
    type: text("type", { enum: ["text", "code", "text_or_image"] })
      .notNull()
      .default("text"),
    sortOrder: integer("sort_order").notNull().default(0),
    optional: integer("optional", { mode: "boolean" }).notNull().default(false),
    initialSource: text("initial_source"),
    helperText: text("helper_text"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("document_template_sections_key_unique").on(
      table.templateId,
      table.internalKey,
    ),
    index("document_template_sections_order_idx").on(
      table.templateId,
      table.sortOrder,
      table.id,
    ),
    check(
      "document_template_sections_key_nonempty",
      sql`length(trim(${table.internalKey})) > 0`,
    ),
    check(
      "document_template_sections_title_nonempty",
      sql`length(trim(${table.displayTitle})) > 0`,
    ),
    check(
      "document_template_sections_type_valid",
      sql`${table.type} in ('text', 'code', 'text_or_image')`,
    ),
  ],
);

export const generatedDocuments = sqliteTable(
  "generated_documents",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    storageUserId: integer("storage_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    templateId: integer("template_id").references(() => documentTemplates.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    offeringId: integer("offering_id")
      .notNull()
      .references(() => subjectOfferings.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    activityId: integer("activity_id").references(() => activities.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    driveFileId: text("drive_file_id").notNull(),
    webViewLink: text("web_view_link").notNull(),
    name: text("name").notNull(),
    googlePermissionStatus: text("google_permission_status", {
      enum: ["not_requested", "granted", "needs_authorization"],
    })
      .notNull()
      .default("not_requested"),
    googleModifiedAt: integer("google_modified_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("generated_documents_owner_drive_unique").on(
      table.ownerUserId,
      table.driveFileId,
    ),
    index("generated_documents_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt,
    ),
    index("generated_documents_offering_idx").on(table.offeringId),
    index("generated_documents_storage_user_idx").on(table.storageUserId),
    check(
      "generated_documents_name_nonempty",
      sql`length(trim(${table.name})) > 0`,
    ),
  ],
);

export const scheduleSlots = sqliteTable(
  "schedule_slots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    offeringId: integer("offering_id")
      .notNull()
      .references(() => subjectOfferings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    locationId: integer("location_id").references(() => locations.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    weekday: integer("weekday").notNull(),
    startsAtMinutes: integer("starts_at_minutes").notNull(),
    endsAtMinutes: integer("ends_at_minutes").notNull(),
    validFrom: text("valid_from"),
    validUntil: text("valid_until"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("schedule_slots_agenda_idx").on(
      table.weekday,
      table.startsAtMinutes,
      table.endsAtMinutes,
    ),
    index("schedule_slots_offering_idx").on(table.offeringId),
    index("schedule_slots_location_idx").on(table.locationId),
    check(
      "schedule_slots_weekday_valid",
      sql`${table.weekday} between 1 and 7`,
    ),
    check(
      "schedule_slots_time_valid",
      sql`${table.startsAtMinutes} between 0 and 1439 and ${table.endsAtMinutes} between 1 and 1440 and ${table.startsAtMinutes} < ${table.endsAtMinutes}`,
    ),
    check(
      "schedule_slots_validity_order",
      sql`${table.validFrom} is null or ${table.validUntil} is null or ${table.validFrom} <= ${table.validUntil}`,
    ),
  ],
);

export const timelineEvents = sqliteTable(
  "timeline_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    offeringId: integer("offering_id")
      .notNull()
      .references(() => subjectOfferings.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    locationId: integer("location_id").references(() => locations.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    type: text("type", {
      enum: ["class", "academic_event", "material", "other"],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
    endsAt: integer("ends_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("timeline_events_offering_time_idx").on(
      table.offeringId,
      table.startsAt,
    ),
    index("timeline_events_time_idx").on(table.startsAt),
    index("timeline_events_location_idx").on(table.locationId),
    check(
      "timeline_events_title_nonempty",
      sql`length(trim(${table.title})) > 0`,
    ),
    check(
      "timeline_events_type_valid",
      sql`${table.type} in ('class', 'academic_event', 'material', 'other')`,
    ),
    check(
      "timeline_events_time_order",
      sql`${table.endsAt} is null or ${table.endsAt} >= ${table.startsAt}`,
    ),
  ],
);

export const classroomSyncStates = sqliteTable(
  "classroom_sync_states",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    offeringId: integer("offering_id")
      .notNull()
      .references(() => subjectOfferings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
    lastSuccessfulSyncAt: integer("last_successful_sync_at", {
      mode: "timestamp_ms",
    }),
    lastErrorCode: text("last_error_code"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.offeringId] }),
    index("classroom_sync_states_stale_idx").on(table.lastSuccessfulSyncAt),
  ],
);

export const classroomFeedItems = sqliteTable(
  "classroom_feed_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    offeringId: integer("offering_id")
      .notNull()
      .references(() => subjectOfferings.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type", {
      enum: ["announcement", "coursework", "material"],
    }).notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    externalUrl: text("external_url"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("classroom_feed_items_identity_unique").on(
      table.userId,
      table.offeringId,
      table.type,
      table.externalId,
    ),
    index("classroom_feed_items_timeline_idx").on(
      table.userId,
      table.offeringId,
      table.publishedAt,
    ),
    check(
      "classroom_feed_items_type_valid",
      sql`${table.type} in ('announcement', 'coursework', 'material')`,
    ),
    check(
      "classroom_feed_items_title_nonempty",
      sql`length(trim(${table.title})) > 0`,
    ),
  ],
);

export const storageSettings = sqliteTable("storage_settings", {
  id: integer("id").primaryKey().default(1),
  includeCohort: integer("include_cohort", { mode: "boolean" })
    .notNull()
    .default(true),
  patternsJson: text("patterns_json").notNull(),
  categoriesJson: text("categories_json").notNull(),
  updatedByUserId: integer("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(timestampNow),
});

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    offeringId: integer("offering_id")
      .notNull()
      .references(() => subjectOfferings.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    name: text("name").notNull(),
    language: text("language").notNull(),
    ignorePreset: text("ignore_preset").notNull(),
    technologiesJson: text("technologies_json").notNull().default("[]"),
    description: text("description"),
    driveProjectFolderId: text("drive_project_folder_id"),
    driveCurrentFolderId: text("drive_current_folder_id"),
    driveVersionsFolderId: text("drive_versions_folder_id"),
    currentVersionNumber: integer("current_version_number")
      .notNull()
      .default(0),
    syncStatus: text("sync_status", {
      enum: ["prepared", "syncing", "complete", "failed"],
    })
      .notNull()
      .default("prepared"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("projects_owner_offering_idx").on(
      table.ownerUserId,
      table.offeringId,
      table.archivedAt,
    ),
    check("projects_name_nonempty", sql`length(trim(${table.name})) > 0`),
    check(
      "projects_sync_status_valid",
      sql`${table.syncStatus} in ('prepared', 'syncing', 'complete', 'failed')`,
    ),
    check(
      "projects_version_nonnegative",
      sql`${table.currentVersionNumber} >= 0`,
    ),
  ],
);

export const projectDirectories = sqliteTable(
  "project_directories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    relativePath: text("relative_path").notNull(),
    driveFolderId: text("drive_folder_id").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("project_directories_path_unique").on(
      table.projectId,
      table.relativePath,
    ),
  ],
);

export const projectFiles = sqliteTable(
  "project_files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    relativePath: text("relative_path").notNull(),
    sha256: text("sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    driveFileId: text("drive_file_id").notNull(),
    mimeType: text("mime_type"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("project_files_path_unique").on(
      table.projectId,
      table.relativePath,
    ),
    index("project_files_drive_idx").on(table.driveFileId),
    check("project_files_size_valid", sql`${table.sizeBytes} >= 0`),
  ],
);

export const projectVersions = sqliteTable(
  "project_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    versionNumber: integer("version_number").notNull(),
    baseVersionNumber: integer("base_version_number"),
    message: text("message"),
    archiveDriveFileId: text("archive_drive_file_id").notNull(),
    manifestJson: text("manifest_json").notNull(),
    addedCount: integer("added_count").notNull().default(0),
    modifiedCount: integer("modified_count").notNull().default(0),
    removedCount: integer("removed_count").notNull().default(0),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    uniqueIndex("project_versions_number_unique").on(
      table.projectId,
      table.versionNumber,
    ),
    index("project_versions_created_idx").on(table.projectId, table.createdAt),
    check("project_versions_number_valid", sql`${table.versionNumber} > 0`),
    check(
      "project_versions_counts_valid",
      sql`${table.addedCount} >= 0 and ${table.modifiedCount} >= 0 and ${table.removedCount} >= 0`,
    ),
  ],
);

export const projectUploadPreviews = sqliteTable(
  "project_upload_previews",
  {
    token: text("token").primaryKey(),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    baseVersionNumber: integer("base_version_number"),
    tempArchivePath: text("temp_archive_path").notNull(),
    manifestJson: text("manifest_json").notNull(),
    ignoredJson: text("ignored_json").notNull(),
    addedCount: integer("added_count").notNull().default(0),
    modifiedCount: integer("modified_count").notNull().default(0),
    removedCount: integer("removed_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("project_upload_previews_expiry_idx").on(table.expiresAt),
    check(
      "project_upload_previews_counts_valid",
      sql`${table.addedCount} >= 0 and ${table.modifiedCount} >= 0 and ${table.removedCount} >= 0`,
    ),
  ],
);

export const studyGroups = sqliteTable(
  "study_groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description"),
    subjectOfferingId: integer("subject_offering_id").references(
      () => subjectOfferings.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("study_groups_offering_idx").on(table.subjectOfferingId),
    check("study_groups_name_nonempty", sql`length(trim(${table.name})) > 0`),
  ],
);

export const studyGroupMembers = sqliteTable(
  "study_group_members",
  {
    groupId: integer("group_id")
      .notNull()
      .references(() => studyGroups.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    memberRole: text("member_role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    joinedAt: integer("joined_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("study_group_members_user_idx").on(table.userId),
    check(
      "study_group_members_role_valid",
      sql`${table.memberRole} in ('owner', 'member')`,
    ),
  ],
);

export const profileTags = sqliteTable(
  "profile_tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    label: text("label").notNull(),
    scopeType: text("scope_type", {
      enum: ["instance", "program", "cohort"],
    }).notNull(),
    programId: integer("program_id").references(() => programs.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    cohortId: integer("cohort_id").references(() => cohorts.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    selfAssignable: integer("self_assignable", { mode: "boolean" })
      .notNull()
      .default(false),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("profile_tags_scope_idx").on(
      table.scopeType,
      table.programId,
      table.cohortId,
    ),
    check("profile_tags_label_nonempty", sql`length(trim(${table.label})) > 0`),
  ],
);

export const userProfileTags = sqliteTable(
  "user_profile_tags",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => profileTags.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    assignedByUserId: integer("assigned_by_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tagId] })],
);

export const noteGroupShares = sqliteTable(
  "note_group_shares",
  {
    noteId: integer("note_id")
      .notNull()
      .references(() => notes.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    groupId: integer("group_id")
      .notNull()
      .references(() => studyGroups.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sharedByUserId: integer("shared_by_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [primaryKey({ columns: [table.noteId, table.groupId] })],
);

export const documentGroupShares = sqliteTable(
  "document_group_shares",
  {
    documentId: integer("document_id")
      .notNull()
      .references(() => generatedDocuments.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    groupId: integer("group_id")
      .notNull()
      .references(() => studyGroups.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    sharedByUserId: integer("shared_by_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    googlePermissionStatus: text("google_permission_status", {
      enum: ["not_requested", "granted", "needs_authorization"],
    })
      .notNull()
      .default("not_requested"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [primaryKey({ columns: [table.documentId, table.groupId] })],
);

export const notePersonShares = sqliteTable(
  "note_person_shares",
  {
    noteId: integer("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    recipientUserId: integer("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sharedByUserId: integer("shared_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [primaryKey({ columns: [table.noteId, table.recipientUserId] })],
);

export const documentPersonShares = sqliteTable(
  "document_person_shares",
  {
    documentId: integer("document_id")
      .notNull()
      .references(() => generatedDocuments.id, { onDelete: "cascade" }),
    recipientUserId: integer("recipient_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sharedByUserId: integer("shared_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    googlePermissionStatus: text("google_permission_status", {
      enum: ["needs_authorization", "granted"],
    })
      .notNull()
      .default("needs_authorization"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    primaryKey({ columns: [table.documentId, table.recipientUserId] }),
  ],
);

export const chatRooms = sqliteTable(
  "chat_rooms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["direct", "group", "audience"] }).notNull(),
    name: text("name"),
    groupId: integer("group_id").references(() => studyGroups.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("chat_rooms_group_unique").on(table.groupId),
    check(
      "chat_rooms_kind_valid",
      sql`${table.kind} in ('direct', 'group', 'audience')`,
    ),
  ],
);

export const chatDirectMembers = sqliteTable(
  "chat_direct_members",
  {
    roomId: integer("room_id")
      .notNull()
      .references(() => chatRooms.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.userId] }),
    index("chat_direct_members_user_idx").on(table.userId),
  ],
);

export const chatRoomAudiences = sqliteTable(
  "chat_room_audiences",
  {
    roomId: integer("room_id")
      .notNull()
      .references(() => chatRooms.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    audienceType: text("audience_type", {
      enum: ["program", "cohort"],
    }).notNull(),
    programId: integer("program_id").references(() => programs.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    cohortId: integer("cohort_id").references(() => cohorts.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  },
  (table) => [
    uniqueIndex("chat_room_audience_unique").on(
      table.roomId,
      table.audienceType,
      table.programId,
      table.cohortId,
    ),
  ],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roomId: integer("room_id")
      .notNull()
      .references(() => chatRooms.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    authorUserId: integer("author_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    bodySource: text("body_source").notNull(),
    replyToMessageId: integer("reply_to_message_id").references(
      (): AnySQLiteColumn => chatMessages.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    editedAt: integer("edited_at", { mode: "timestamp_ms" }),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("chat_messages_room_cursor_idx").on(table.roomId, table.id),
    check("chat_messages_body_size", sql`length(${table.bodySource}) <= 10000`),
  ],
);

export const chatMessageMentions = sqliteTable(
  "chat_message_mentions",
  {
    messageId: integer("message_id")
      .notNull()
      .references(() => chatMessages.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    mentionedUserId: integer("mentioned_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    primaryKey({ columns: [table.messageId, table.mentionedUserId] }),
  ],
);

export const chatAttachments = sqliteTable(
  "chat_attachments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    messageId: integer("message_id")
      .notNull()
      .references(() => chatMessages.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    ownerUserId: integer("owner_user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    storageName: text("storage_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("chat_attachments_message_idx").on(table.messageId),
    check("chat_attachments_size_valid", sql`${table.sizeBytes} > 0`),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    type: text("type").notNull(),
    actorUserId: integer("actor_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    bodyPreview: text("body_preview"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(timestampNow),
  },
  (table) => [
    index("notifications_user_unread_idx").on(
      table.userId,
      table.readAt,
      table.id,
    ),
  ],
);
