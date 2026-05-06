import { connectedAgents } from './agentState';

console.log('--- Connected Agents Diagnostic ---');
console.log('Total:', connectedAgents.size);
console.log('Agents:', JSON.stringify(Array.from(connectedAgents.entries()), null, 2));
console.log('---------------------------------');
