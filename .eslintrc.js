module.exports = {
	env: {
		es2021: true,
	},
	root: true,
	parser: '@typescript-eslint/parser',
	plugins: ['@typescript-eslint'],
	extends: ['eslint:recommended'],
	globals: {
		NodeJS: true
	},
	rules: {
		'no-unused-vars': 'off',
		'no-empty-function': 'off',
		'no-useless-escape': 'off',
	},
}
