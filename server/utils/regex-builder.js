let legend = {
	'{user}': /([a-zA-Z0-9_]+)/,
	'{target}': /([a-zA-Z0-9_]+)/,
	'{value}': /([0-9]+)/
};

let build = (data) => {
	let replacements = Object.keys(legend);
    let query = data;
    replacements.forEach(key => {
        query = query.replace(new RegExp(key, 'gi'), legend[key].source);
    });

    return query;
};

let escape = (s) => {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = {
	build
}