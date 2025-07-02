#!/bin/bash

# Load environment variables from env file, if no file path is provided, it will load from .env file in the current directory
# Usage: source ./scripts/load_env.sh [env_file_path]

# Default .env file path
ENV_FILE="${1:-.env}"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Warning: Environment file '$ENV_FILE' not found"
    return 1 2>/dev/null || exit 1
fi

echo "Loading environment variables from: $ENV_FILE"

# Read .env file and export variables
# Skip empty lines and comments (lines starting with #)
while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines
    [ -z "$line" ] && continue
    
    # Skip comments (lines starting with #)
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    
    # Skip lines that don't contain =
    [[ "$line" =~ = ]] || continue
    
    # Remove leading/trailing whitespace
    line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    
    # Extract variable name and value
    var_name=$(echo "$line" | cut -d'=' -f1)
    var_value=$(echo "$line" | cut -d'=' -f2-)
    
    # Remove quotes from value if present
    var_value=$(echo "$var_value" | sed 's/^"//;s/"$//')
    var_value=$(echo "$var_value" | sed "s/^'//;s/'$//")
    
    # Export the variable
    if [ -n "$var_name" ]; then
        export "$var_name"="$var_value"
        echo "Exported: $var_name"
    fi
done < "$ENV_FILE"

echo "Environment variables loaded successfully from $ENV_FILE"
