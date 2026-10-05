import { supabase } from './supabase';

export interface AiGeneratedItem { code: string; title: string; description: string; [key: string]: string; }

export async function generateItems(module: string, description: string, context?: { projectName?: string; existingItems?: string[] }): Promise<AiGeneratedItem[]> {
  const { data, error } = await supabase.functions.invoke('ai-generate', { body: { module, description, context } });
  if (error) throw error;
  if (!data?.items) throw new Error('No items returned from AI');
  return data.items as AiGeneratedItem[];
}
