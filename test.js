require('babel-register');

var Koa = require('koa');
var cors = require('kcors');
var body = require('koa-better-body');
var app = new Koa();

var HttpPack = require('./lib/HttpPack').default;

var hp = new HttpPack();

app
    .use(cors())
    .use(body({
        buffer: true
    }))
    .use(function(ctx, next){
        return ctx.request.buffer().then(function(body){
            return hp.parseBody('user1', body, function(scope, payload){
                console.log(scope + ": " + payload + ".");
                if(payload.toString('utf-8') == 'do you copy?'){
                    hp.commit('user1', new Buffer('roger0', 'utf-8'), 0);
                    hp.commit('user1', new Buffer('roger1', 'utf-8'), 1);
                    hp.commit('user1', new Buffer('roger2', 'utf-8'), 2);
                }
            }).then(function(){
                return hp.generateBody('user1').then(function(respondBody){
                    ctx.response.body = respondBody;
                    return next();
                });
            });
        });
    });

app.listen(8080);