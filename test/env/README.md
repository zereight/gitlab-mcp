how to use test gitlab env
    this env is dangerous. Because pass or token is public, So don't enter credential data in this test gitlab env.
    
start test gitlab enviroment
    docker compose up -d
backup gitlab DATA in dump
    docker exec env-web-1 bash /etc/dump/backup.sh
restore gitlab DATA from dump
    docker exec env-web-1 bash /etc/dump/restore.sh

gitlab test users and pass
    root avaefacaweaef
    test_admin avaefacaweaef
    test_developer avaefacaweaef
    test_user avaefacaweaef

set up test repo in your local
    git init -b main
    git config user.name test_admin
    git config user.email test_admin@example.com
    git remote add origin git@localhost:test_group/test_project.git
    git remote set-url origin http://test_admin:gitlab-pat@localhost:8080/test_group/test_project.git
    git pull origin main
    docker build --platform=linux/arm64 -t iwakitakuma/gitlab-mcp . 
    docker stop gitlab-mcp
    docker rm gitlab-mcp
    docker run -id \
    --name gitlab-mcp  \
    -e GITLAB_PERSONAL_ACCESS_TOKEN=gitlab-pat \
    -e GITLAB_API_URL="http://host.docker.internal:8080/api/v4"\
    -e USE_GITLAB_WIKI=true \
    -e GITLAB_IS_OLD=true \
    -e USE_MILESTONE=true \
    -e USE_PIPELINE=true \
    -e SSE=true \
    -p 3333:3002 \
    iwakitakuma/gitlab-mcp
