-- Yearly plan items get a category. The category list itself lives in profile.settings.planCats
-- (user-editable; defaults Physical / Oral / Mental / Skin health). Blank = "Other".
alter table health.plans add column if not exists category text not null default '';
