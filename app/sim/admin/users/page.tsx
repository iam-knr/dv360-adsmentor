import { redirect } from 'next/navigation';

// Users are managed in /manage (module 19, RC-068).
export default function AdminUsersPage() {
  redirect('/manage/accounts');
}
