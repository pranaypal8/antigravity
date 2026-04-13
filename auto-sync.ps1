$folderToWatch = "specialone"

Write-Host "Starting Auto-Sync for '$folderToWatch'..."
Write-Host "I will check for changes every 60 seconds and auto-push them to GitHub."
Write-Host "Press Ctrl+C to stop."
Write-Host ""

while ($true) {
    # Check if there are any changes in the folder
    $changes = git status --porcelain $folderToWatch

    if ($changes) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Changes detected! Uploading..." -ForegroundColor Yellow
        
        # Add changes
        git add $folderToWatch
        
        # Commit with a timestamp
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        git commit -m "Auto-commit: $timestamp" | Out-Null
        
        # Push to GitHub
        git push origin main | Out-Null
        
        Write-Host "Successfully uploaded to GitHub." -ForegroundColor Green
    }

    # Wait for 60 seconds before checking again
    Start-Sleep -Seconds 60
}
