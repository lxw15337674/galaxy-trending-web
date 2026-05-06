UPDATE `youtube_hot_hourly_items`
SET `description` = NULL
WHERE `description` IS NOT NULL;
