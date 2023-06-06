## Mongoose Query Express

### Info
Library to for Express to create simple reusable queries and logic for mongoose.\
Never write the simple get, post, patch and delete function over and over again.\

Used in combination with [mongoose-query](https://github.com/EmilsWebbod/mongoose-query) to create the model logic.\

### Usage
```
import { QueryExpress, QueryModel, QueryOptions } from 'mongoose-query-express';

const options = new QueryOptions({ .... });
const userQueryModel = new QueryModel<User>(User, options);
const userQuery = new QueryExpress('user', userQueryModel, {...});

const user = express();

user.param('id', userQuery.param);
user.get('/', userQuery.get);
user.post('/', userQuery.post);
user.patch('/:id', userQuery.patch);
user.delete('/:id', userQuery.delete); // Can also use userQuery.archive if archive option set.
```
