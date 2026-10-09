import { supabase } from './supabase';

export async function createStarterProjectData(projectId: string): Promise<void> {
  const { data: requirements, error: requirementsError } = await supabase.from('requirements').insert([
    {
      project_id: projectId,
      code: 'REQ-001',
      title: 'Users can sign in securely',
      description: 'Users can sign in with valid credentials and receive a clear error for invalid credentials.',
      category: 'Security',
      priority: 'High',
      status: 'Reviewed',
      custom_fields: {},
    },
    {
      project_id: projectId,
      code: 'REQ-002',
      title: 'Users can view their project dashboard',
      description: 'Authenticated users can see current release progress, test results, and open defects.',
      category: 'Functional',
      priority: 'Medium',
      status: 'Draft',
      custom_fields: {},
    },
  ]).select('id, code');
  if (requirementsError) throw requirementsError;

  const signInRequirement = requirements?.find((requirement) => requirement.code === 'REQ-001');
  const { data: testCases, error: testCasesError } = await supabase.from('test_cases').insert([
    {
      project_id: projectId,
      requirement_id: signInRequirement?.id ?? null,
      code: 'TC-001',
      title: 'Sign in with valid credentials',
      cycle: 'SIT',
      steps: 'Enter a valid email and password, then select Sign in.',
      expected_result: 'The user reaches the project dashboard.',
      status: 'Not Run',
      custom_fields: {},
    },
  ]).select('id');
  if (testCasesError) throw testCasesError;

  const { error: defectsError } = await supabase.from('defects').insert({
    project_id: projectId,
    test_case_id: testCases?.[0]?.id ?? null,
    code: 'DEF-001',
    title: 'Add a release-blocking defect here',
    severity: 'High',
    description: 'Use this example to see how a failed test can become visible in the release dashboard.',
    status: 'Open',
    custom_fields: {},
  });
  if (defectsError) throw defectsError;
}
