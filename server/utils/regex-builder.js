

let legend = {
    '{user}': 'member',
    '{achievement}': 'achievement'
};

let escapeRegExp = (string) => {
  return string.replace(/[.*+?^$()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

let build = (data) => {
    console.log(data);
    let replacements = Object.keys(legend);
    let query = data.chatMessage;
    query = escapeRegExp(query);
    replacements.forEach(key => {
        query = query.replace(new RegExp(key, 'gi'), data[legend[key]]);
    });

    return query;
};

module.exports = {
    build
}