#!/bin/bash
gitlab-backup create
tar zcvf gitlab_config.tgz /etc/gitlab
cp "$(ls -t /var/opt/gitlab/backups/*.tar | head -n 1)" /etc/dump/custom_gitlab_backup.tar
cp gitlab_config.tgz /etc/dump
