# Administrator two-step verification

Since 3.1.0, each Admin account can add a time-based one-time code (TOTP) from an authenticator app. It is optional and off by default: existing accounts keep signing in with their password until an administrator turns it on for their own account. It protects the private Admin only; App user accounts are not affected.

Open **Admin → My account · Security**, enter your current password and choose **Set up authenticator**. Scan the QR code or type the manual key into a TOTP authenticator. Confirm with a six-digit code. Codes renew every 30 seconds; keep the server and phone clocks synchronized.

Save the ten recovery codes when shown. They appear only once, are stored only as hashes and each works once. The TOTP secret is encrypted using the instance encryption key. Back up that key separately; never share the QR code or manual secret.

After activation, password validation creates only a temporary challenge. No complete Admin session exists before verification. A challenge lasts five minutes and permits five attempts. Reused time steps are rejected; wait for a new authenticator code if the current one was just used to activate/manage MFA. Failed second-factor attempts also have an account-wide 15-minute limit across new challenges.

Disabling MFA or replacing recovery codes requires the current password and an unused authenticator/recovery code. Other Admin sessions are signed out. These actions and operational recovery are audited without recording secrets.

## Lost authenticator and recovery codes

A trusted server operator can recover the account locally. There is no public reset endpoint. Keep a backup and verify the account identity before running the interactive command in the **Admin container**:

```sh
docker ps --format '{{.Names}}' | grep openstudyhub-admin
docker exec -it YOUR_ADMIN_CONTAINER node dist/admin-mfa-recover.mjs
```

The command asks for the administrator login and an explicit `RESET login` confirmation. It disables MFA for that account, ends all of its sessions and records an audit event. Sign in and configure a new authenticator. Do not remove the MFA tables or alter historical migrations.

For a source checkout with its normal environment loaded, the equivalent command is `pnpm exec tsx scripts/admin-mfa-recover.ts`. The absolute `OPENSTUDYHUB_V2_DATABASE_PATH` must point to the canonical database.
