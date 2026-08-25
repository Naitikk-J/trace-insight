import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { profileQuery, rolesQuery } from "@/lib/api/queries";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setUser(next?.user ?? null);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: roles } = useQuery(rolesQuery(user?.id));

  return {
    session,
    user,
    loading,
    profile: profile ?? null,
    roles: roles ?? [],
    isAdmin: (roles ?? []).includes("admin"),
    signOut: () => supabase.auth.signOut(),
  };
}
