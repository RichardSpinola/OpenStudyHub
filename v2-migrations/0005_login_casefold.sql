CREATE UNIQUE INDEX users_login_casefold ON users(lower(login));
CREATE UNIQUE INDEX admin_accounts_login_casefold ON admin_accounts(lower(login));
