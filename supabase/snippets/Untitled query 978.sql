select
  users.email,
  admins.created_at
from private.content_admins as admins
join auth.users as users
  on users.id = admins.user_id;