#!/bin/bash
set -e

SOURCE_DUMP_PATH="/etc/dump"
BACKUP_FILE="${SOURCE_DUMP_PATH}/custom_gitlab_backup.tar"
CONFIG_TAR_FILE="${SOURCE_DUMP_PATH}/gitlab_config.tgz"
GITLAB_BACKUPS_DIR="/var/opt/gitlab/backups"
GITLAB_CONFIG_DIR="/etc/gitlab"

echo "Starting GitLab restore process..."

TMP_WORK_DIR="/tmp/gitlab_restore_work"
mkdir -p "$TMP_WORK_DIR"
cp "$CONFIG_TAR_FILE" "$TMP_WORK_DIR/"

echo "Extracting GitLab configuration..."
tar zxvf "${TMP_WORK_DIR}/$(basename "$CONFIG_TAR_FILE")" -C "$TMP_WORK_DIR"
cp "$TMP_WORK_DIR/etc/gitlab/gitlab.rb" "$GITLAB_CONFIG_DIR/gitlab.rb"
cp "$TMP_WORK_DIR/etc/gitlab/gitlab-secrets.json" "$GITLAB_CONFIG_DIR/gitlab-secrets.json"
chown root:root "$GITLAB_CONFIG_DIR/gitlab.rb" "$GITLAB_CONFIG_DIR/gitlab-secrets.json"
chmod 600 "$GITLAB_CONFIG_DIR/gitlab.rb" "$GITLAB_CONFIG_DIR/gitlab-secrets.json"

rm -rf "$TMP_WORK_DIR"

# ここに gitlab-ctl reconfigure を追加します
echo "Running initial gitlab-ctl reconfigure to generate necessary files..."
gitlab-ctl reconfigure

echo "Stopping GitLab services for restore..."
gitlab-ctl stop puma
gitlab-ctl stop sidekiq

mkdir -p "$GITLAB_BACKUPS_DIR"

echo "Copying backup file..."
cp "$BACKUP_FILE" "$GITLAB_BACKUPS_DIR/"
chown git:git "$GITLAB_BACKUPS_DIR/$(basename "$BACKUP_FILE")"

echo "Restoring GitLab backup..."
gitlab-backup restore BACKUP=custom force=yes

echo "Reconfiguring GitLab after restore..."
gitlab-ctl reconfigure

echo "Starting GitLab services..."
gitlab-ctl start

echo "Checking GitLab status..."
gitlab-ctl status

echo "Running GitLab check..."
gitlab-rake gitlab:check SANITIZE=true
