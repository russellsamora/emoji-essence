import App from './App.svelte';

const app = new App({
	target: document.body,
	props: {
		title: 'What is your emoji essence?'
	}
});

export default app;