import fetch from 'node-fetch';

async function testDirectGraphQL() {
  const graphqlUrl = 'http://gitlab.agodadev.io/api/graphql';
  const token = 'BXz2RUsdvggHkypZsfsW'; // Your working token from curl
  
  const graphqlQuery = {
    query: `{
      vulnerability(id: "gid://gitlab/Vulnerability/12094621") {
        title
        description
        state
        severity
        reportType
        project {
          id
          name
          fullPath
        }
        detectedAt
        confirmedAt
        resolvedAt
        resolvedBy {
          id
          username
        }
      }
    }`,
    variables: {}
  };

  try {
    console.log('🔍 Testing direct GraphQL call to:', graphqlUrl);
    console.log('📝 Query:', JSON.stringify(graphqlQuery, null, 2));
    
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': token,
      },
      body: JSON.stringify(graphqlQuery),
    });

    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.json();
    console.log('✅ GraphQL Response:');
    console.log(JSON.stringify(result, null, 2));

    if (result.errors) {
      console.error('❌ GraphQL Errors:', result.errors);
    }
    
    if (result.data && result.data.vulnerability) {
      console.log('🎯 Vulnerability found!');
      console.log('Title:', result.data.vulnerability.title);
      console.log('State:', result.data.vulnerability.state);
      console.log('Severity:', result.data.vulnerability.severity);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDirectGraphQL(); 