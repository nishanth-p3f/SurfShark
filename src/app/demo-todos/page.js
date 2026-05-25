import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Note: This expects a 'todos' table to exist in your Supabase database.
  // It is provided as a test route to verify your SSR cookie setup.
  const { data: todos, error } = await supabase.from('todos').select();

  if (error) {
    return (
      <div style={{ padding: '24px', fontFamily: 'sans-serif', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
        <h3 style={{ color: 'var(--danger)' }}>Supabase SSR Query Test</h3>
        <p>{error.message}</p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          This route was created to match the Supabase SSR tutorial. To make this query succeed, ensure that a <code>todos</code> table (with columns like <code>id</code> and <code>name</code>) is created inside your Supabase Database.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'sans-serif', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>Supabase SSR Cookie Query Success!</h2>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        The query ran successfully. Below is the list of records retrieved dynamically from your Supabase <code>todos</code> table:
      </p>
      
      <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
        {todos?.map((todo) => (
          <li key={todo.id} style={{ fontWeight: '500' }}>{todo.name}</li>
        ))}
      </ul>
      
      {(!todos || todos.length === 0) && (
        <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
          No todos found in the database. Add some rows in your Supabase Dashboard &rarr; Table Editor to see them display here!
        </p>
      )}
    </div>
  );
}
