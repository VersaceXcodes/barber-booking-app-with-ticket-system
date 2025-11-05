// Test the improved formatTicketNumber function

const formatTicketNumber = (value) => {
  if (!value) return '';
  
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  
  // Don't reformat if already in valid format
  if (/^TKT-\d{8}-\d{1,3}$/.test(cleaned)) {
    return cleaned;
  }
  
  const withoutHyphens = cleaned.replace(/-/g, '');
  
  if (!withoutHyphens) return '';
  
  // If doesn't start with TKT, add it
  if (!withoutHyphens.startsWith('TKT')) {
    if (withoutHyphens.length <= 3) {
      return withoutHyphens;
    }
    return 'TKT-' + withoutHyphens;
  }
  
  const rest = withoutHyphens.slice(3);
  
  if (rest.length === 0) {
    return 'TKT';
  }
  
  if (rest.length <= 8) {
    return `TKT-${rest}`;
  }
  
  return `TKT-${rest.slice(0, 8)}-${rest.slice(8, 11)}`;
};

// Test cases
console.log('Test 1 - Empty string:', formatTicketNumber('') === '');
console.log('Test 2 - Just TKT:', formatTicketNumber('TKT') === 'TKT');
console.log('Test 3 - Partial date:', formatTicketNumber('TKT-2024') === 'TKT-2024');
console.log('Test 4 - Complete partial:', formatTicketNumber('TKT-20240115') === 'TKT-20240115');
console.log('Test 5 - Valid full:', formatTicketNumber('TKT-20240115-001') === 'TKT-20240115-001');
console.log('Test 6 - Input without TKT:', formatTicketNumber('20240115001') === 'TKT-20240115001');
console.log('Test 7 - Already valid not corrupted:', formatTicketNumber('TKT-20241105-123') === 'TKT-20241105-123');

// The problematic case from the bug report
const problematicInput = 'TKT-2024-003';
const result = formatTicketNumber(problematicInput);
console.log('\nProblematic case test:');
console.log('Input:', problematicInput);
console.log('Output:', result);
console.log('Should format to: TKT-2024003 (intermediate) or keep as-is if already completing');

// Simulate typing TKT-20240115-001 character by character
console.log('\nSimulate typing TKT-20240115-001:');
const typing = 'TKT-20240115-001';
for (let i = 1; i <= typing.length; i++) {
  const partial = typing.slice(0, i);
  const formatted = formatTicketNumber(partial);
  console.log(`"${partial}" -> "${formatted}"`);
}
