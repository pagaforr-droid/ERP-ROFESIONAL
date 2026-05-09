const fs = require('fs');
const file = 'c:\\Users\\usuario\\Downloads\\traceflow-erp (1)\\components\\MasterData.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<\/div>\s*<\/div>\s*<\/div>\s*}\)\s*\{activeTab === 'TRANSFER'/m;
const replacement = `</div>\n      </div>\n      )}\n\n      {activeTab === 'TRANSFER'`;

content = content.replace(regex, replacement);

// Fallback if the regex didn't match exactly (e.g. carriage returns)
content = content.replace('</div>\n        </div>\n      </div>\n      )}', '</div>\n      </div>\n      )}');
content = content.replace('</div>\r\n        </div>\r\n      </div>\r\n      )}', '</div>\r\n      </div>\r\n      )}');

fs.writeFileSync(file, content);
console.log('Fixed div');
