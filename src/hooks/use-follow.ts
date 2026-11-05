import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** One relationship cache shared by the feed and creator profiles. */
export function useFollow(creatorId: string, userId?: string) {
  const client = useQueryClient();
  const key = ["follow", userId, creatorId];
  const ownProfile = creatorId === userId;
  const relationship = useQuery({
    queryKey: key,
    enabled: !!userId && !ownProfile,
    queryFn: async () => {
      if (!userId) return false;
      const { data, error } = await supabase.from("follows").select("following_id").eq("follower_id", userId).eq("following_id", creatorId).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  const mutation = useMutation({
    mutationFn: async (following: boolean) => {
      if (!userId || ownProfile) return;
      const result = following
        ? await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", creatorId)
        : await supabase.from("follows").insert({ follower_id: userId, following_id: creatorId });
      if (result.error) throw result.error;
      client.setQueryData(key, !following);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["profile", creatorId] }),
        client.invalidateQueries({ queryKey: ["profile", userId] }),
        client.invalidateQueries({ queryKey: ["feed", "following", userId] }),
      ]);
    },
    onError: () => toast.error("Couldn't update follow. Try again."),
  });
  return {
    following: relationship.data === true,
    ownProfile,
    pending: mutation.isPending || (!!userId && !ownProfile && relationship.isPending),
    toggle: () => {
      if (!userId) { toast("Sign in to follow creators"); return; }
      if (ownProfile || mutation.isPending || relationship.isPending || relationship.isError) return;
      mutation.mutate(relationship.data === true);
    },
  };
}