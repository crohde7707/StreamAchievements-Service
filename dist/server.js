!function(e){var t={};function n(i){if(t[i])return t[i].exports;var o=t[i]={i:i,l:!1,exports:{}};return e[i].call(o.exports,o,o.exports,n),o.l=!0,o.exports}n.m=e,n.c=t,n.d=function(e,t,i){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:i})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var i=Object.create(null);if(n.r(i),Object.defineProperty(i,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)n.d(i,o,function(t){return e[t]}.bind(null,o));return i},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=13)}([function(e,t){e.exports=require("mongoose")},function(e,t){e.exports=require("passport")},function(e,t){e.exports={twitch:{clientID:"zx83pxp0b4mkeu931upd21a6f9clv4",clientSecret:"zzagacb4su7w9yaxym6d5b3l86hyne"},mongodb:{dbURI:"mongodb+srv://phirebot:9EqNSsFh0eS9m62h@twitchachievements-nufmb.mongodb.net/prodmain1?retryWrites=true"},session:{cookieKey:"tacosarelovetacosarelyfe"},cloudinary:{name:"phirehero",apiKey:"847339621479345",apiSecret:"j7Tj95LSPHS42YriTqnUBM5O00k"},patreon:{clientID:"Ak6jDxJVVI2_CPMF3mvHzHOfzINly-gJJkiXQwgbhCloUnzNZUnGF7qxSwKBT2vZ",clientSecret:"mz6muVv0Cl7OIEqrBSqUSmossvEl75bznBTlOTmT8Q2lPdAbp-BUrFbG-InchODp",accessToken:"VFNnMNqc1pEl8Nd7YJehEVifujbZYdudF1vNK1EOhKQ",refreshToken:"h7tJScqkirZZw2Ri63gVaQ8VDVO-4ByYSEomdAOJVms"},patreon2:{clientID:"kRgPLCW6NlDz0cL9sWHBxLYDSFsS1X5wHRbnw_wz5vYA0tVQV2ZWAu4iWrNuLj2u",clientSecret:"mYCvx7zBn0lR5hr7w8xACQETsjJ4N1W7m5VW4KSVdY7HFhAB9_52bdIRyrrO9qhc",accessToken:"1WLiOvugP73yITMOli3cZ10QOtMv-K0vEEcKIVB8noM",refreshToken:"M2upbILDRzGSHG1dv6xMwwexfAlNnk4sGoOzuWCFStY"},phirebot:{token:"oauth:poux5p75u6q7nymldu2c4s7vtijiuj",username:"stream_achievements"},gmail:{user:"streamachievements.official@gmail.com",pass:"77!3l3m3nt!7",clientID:"614872903634-6uieq8i9h5b5nqmesd6ov78hfl559gs1.apps.googleusercontent.com",clientSecret:"txVQhufvJ21U98IJMokbruUt",accessToken:"ya29.GlsJB1J95rVL5Ygo_ZxnoBjCT1T84x-gBaAy-datKmczNnPva9W7uz5OiJD508zRP81zUQnoHSlqsJqFt-mczk3sacMii0FCJJngyvxyofcbwAsgnLwmeKsphwh0",refreshToken:"1/2sHD7HvCq4R80UtvC9mD6VbLAKUbqb7-ITkOXYgbArI"}}},function(e,t,n){const i=n(0),o=new(0,i.Schema)({name:String,twitchID:String,logo:String,email:String,type:String,channels:[{channelID:String,achievements:[{aid:Number,earned:Date}]}],integration:Object}),s=i.model("user",o);e.exports=s},function(e,t){e.exports=require("express")},function(e,t){e.exports=require("cryptr")},function(e,t,n){const i=n(3),o=n(2),s=new(n(5))(o.session.cookieKey);e.exports={authCheck:(e,t,n)=>{e.user?n():t.redirect("/auth/twitch")},isAuthorized:async(e,t,n)=>{let o=s.decrypt(e.cookies.etid),r=await i.findOne({"integration.twitch.etid":o});r?(e.user=r,t.cookie("etid",e.cookies.etid,{maxAge:864e5,httpOnly:!1,domain:"streamachievements.com"}),n()):(t.clearCookie("etid"),t.status(401),t.redirect("http://streamachievements.com"))},isAdminAuthorized:async(e,t,n)=>{let o=s.decrypt(e.cookies.etid),r=await i.findOne({"integration.twitch.etid":o});r&&(r.type="admin")?(t.user=r,t.cookie("etid",e.cookies.etid,{maxAge:864e5,httpOnly:!1,domain:"streamachievements.com"}),n()):(t.status(401),t.json({message:"You are not authorized to make this request."}),n())}}},function(e,t,n){const i=n(0),o=new(0,i.Schema)({owner:String,twitchID:String,theme:String,logo:String,achievements:Array,members:Array,icons:{default:String,hidden:String}}),s=i.model("channel",o);e.exports=s},function(e,t,n){const i=n(0),o=new(0,i.Schema)({name:String,type:String,channel:String,cloudID:String,url:String,achievementID:String}),s=i.model("image",o);e.exports=s},function(e,t,n){const i=n(0);var o=new(0,i.Schema)({uid:String,token:String,created:Date});o.methods.hasExpired=function(){return Date.now()-Date.parse(this.created)>2592e5};const s=i.model("token",o);e.exports=s},function(e,t,n){const i=n(0),o=new(0,i.Schema)({uid:Number,channel:String,title:String,description:String,icon:String,earnable:Boolean,limited:Boolean,secret:Boolean,listener:String,first:String,earned:Date}),s=i.model("achievement",o);e.exports=s},function(e,t,n){const i=n(0),o=i.Schema,s=new o({channel:String,code:String,type:String,bot:String,query:o.Types.Mixed,condition:String,achievement:String}),r=i.model("listener",s);e.exports=r},function(e,t,n){const i=n(2),o=n(8);let s=n(32).v2;s.config({cloud_name:i.cloudinary.name,api_key:i.cloudinary.apiKey,api_secret:i.cloudinary.apiSecret});e.exports={uploadImage:(e,t,n,i)=>{return new Promise((r,a)=>{o.findOne({name:t,channel:n}).then(c=>{c?(console.log("\nimage already exists"),r(c)):(console.log("\nnew image"),s.uploader.upload(e,(e,s)=>{e?(console.log(e),a({error:e})):(console.log("\nimage uploaded successfully"),new o({name:t,channel:n,cloudID:s.public_id,url:s.url,type:i||"achievement"}).save().then(e=>{console.log("new image in DB"),r(e)}))}))})})},destroyImage:e=>new Promise((t,n)=>{s.uploader.destroy(e,function(e){t(e)})})}},function(e,t,n){e.exports=n(14)},function(e,t,n){(function(e){const t=n(4),i=n(15),o=n(0),s=n(16),r=n(1),a=n(2),c=(n(17),n(19)),l=n(20),d=n(21).refreshCookie,h=n(22).allowAccess;let u=n(23),m=n(27);const p=process.env.PORT||5e3;let g=t();g.set("view engine","ejs"),g.use(c()),g.use(l({limit:"50mb",extended:!0})),o.connect(a.mongodb.dbURI,{useNewUrlParser:!0},()=>{console.log("connected to mongodb")}),g.use(s({name:"e2tid",maxAge:1e3,keys:a.session.cookieKey,cookie:{httpOnly:!0,expires:new Date(Date.now()+36e5)}})),g.use(r.initialize()),g.use(r.session()),g.use(t.static("public")),g.use("/auth",[h,d],u),g.use("/api",[h,d],m),g.use(t.static(i.join(e,"client/build")));g.listen(p);console.log(`Express app listening on port ${p}`)}).call(this,"/")},function(e,t){e.exports=require("path")},function(e,t){e.exports=require("cookie-session")},function(e,t,n){const i=n(1),o=n(18).Strategy,s=n(2),r=n(3),a=new(n(5))(s.session.cookieKey);process.env.SESSION_SECRET;i.serializeUser((e,t)=>{console.log("serializeUser"),t(null,e)}),i.use(new o({clientID:s.twitch.clientID,clientSecret:s.twitch.clientSecret,callbackURL:"http://api.streamachievements.com/auth/twitch/redirect"},(e,t,n,i)=>{console.log(n);let o=a.encrypt(e),s=a.encrypt(t),c={etid:n.id.toString(),token:o,refresh:s};r.findOne({"integration.twitch.etid":c.etid}).then(e=>{e?(e.integration.twitch=c,e.name!==n.username&&(e.name=n.username),e.logo!==n._json.logo&&(e.logo=n._json.logo),e.email!==n.email&&(e.email=n.email),e.save().then(t=>{console.log("found user, logging in..."),i(null,e)})):new r({name:n.username,logo:n._json.logo,email:n.email,type:"user",channels:[],integration:{twitch:c}}).save().then(e=>{i(null,e)})})}))},function(e,t){e.exports=require("passport-twitch")},function(e,t){e.exports=require("cookie-parser")},function(e,t){e.exports=require("body-parser")},function(e,t){e.exports={refreshCookie:async(e,t,n)=>{console.log(e.session),e.session.fake=Date.now(),n()}}},function(e,t){e.exports={allowAccess:async(e,t,n)=>{var i=e.headers.origin;["http://www.streamachievements.com","http://streamachievements.com","https://www.streamachievements.com","https://streamachievements.com"].indexOf(i)>-1&&t.setHeader("Access-Control-Allow-Origin",i),t.header("Access-Control-Allow-Credentials",!0),t.header("Access-Control-Allow-Headers","Origin, X-Requested-With, Content-Type, Accept"),n()}}},function(e,t,n){const i=n(4).Router(),o=n(1),s=n(2),r=n(5),a=n(24),c=new r(s.session.cookieKey),l=n(6).isAuthorized;n(3);n(25);let d=n(26),h=d.patreon,u=(0,d.oauth)(s.patreon2.clientID,s.patreon2.clientSecret);const m="http://api.streamachievements.com/auth/patreon/redirect",p="https://www.patreon.com/api/oauth2/v2/identity?include=memberships&fields%5Buser%5D=thumb_url,vanity";i.get("/twitch",o.authenticate("twitch",{scope:["user_read"]})),i.get("/twitch/redirect",o.authenticate("twitch"),(e,t)=>{e.session.user=e.user;var n=e.cookies.etid;if(void 0===n||n!==e.user.integration.twitch.etid){let n=c.encrypt(e.user.integration.twitch.etid);console.log(n),t.cookie("etid",n,{maxAge:864e5,httpOnly:!1,domain:"streamachievements.com"})}else console.log("cookie exists",n);t.redirect("http://www.streamachievements.com/home")}),i.get("/patreon",l,(e,t)=>{let n="https://www.patreon.com/oauth2/authorize?";n+="response_type=code&",n+="client_id="+s.patreon2.clientID+"&",n+="redirect_uri="+m,n+="&scope=campaigns%20identity%20identity%5Bemail%5D%20campaigns.members",t.redirect(n)}),i.get("/patreon/redirect",l,(e,t)=>{let n=e.query.code;return u.getTokens(n,m).then(t=>{h(t.access_token);let n=e.cookies.etid;return new Promise((e,i)=>{let o,s,r=c.encrypt(t.access_token),l=c.encrypt(t.refresh_token);a.get(p,{headers:{Authorization:`Bearer ${t.access_token}`}}).then(i=>{if(o=i.data.data.attributes.vanity,s=i.data.data.attributes.thumb_url,i.data.included){let c=i.data.included[0].id;a.get(`https://www.patreon.com/api/oauth2/v2/members/${c}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`,{headers:{Authorization:`Bearer ${t.access_token}`}}).then(t=>{let i=t.data.data.attributes.patron_status,a=t.data.data.attributes.is_follower,d=t.data.data.relationships.currently_entitled_tiers.data.map(e=>e.id).indexOf("3497710")>=0;e({id:c,thumb_url:s,vanity:o,at:r,rt:l,etid:n,is_follower:a,status:i,is_gold:d})})}else e({thumb_url:s,vanity:o,at:r,rt:l,etid:n})})})}).then(n=>{let{id:i,thumb_url:o,vanity:s,at:r,rt:a,etid:c,is_follower:l,status:d,is_gold:h}=n,u=Object.assign({},e.user.integration);u.patreon={id:i,thumb_url:o,vanity:s,at:r,rt:a,is_follower:l,status:d,is_gold:h},e.user.integration=u,e.user.save().then(e=>{t.redirect("http://streamachievements.com/profile")})})}),i.post("/patreon/sync",l,(e,t)=>{g(e.user,e.cookies.etid).then(e=>{t.json({message:"return back updated patreon data to store"})})});let g=(e,t)=>e.integration.patreon?new Promise((n,i)=>{let{at:o,rt:s,id:r}=e.integration.patreon,l=c.decrypt(o);a.get(p,{headers:{Authorization:`Bearer ${l}`}}).then(i=>{if(vanity=i.data.data.attributes.vanity,thumb_url=i.data.data.attributes.thumb_url,i.data.included){let r=i.data.included[0].id;a.get(`https://www.patreon.com/api/oauth2/v2/members/${r}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`,{headers:{Authorization:`Bearer ${l}`}}).then(i=>{let a=i.data.data.attributes.patron_status,c=i.data.data.attributes.is_follower,l=i.data.data.relationships.currently_entitled_tiers.data.map(e=>e.id).indexOf("3497710")>=0,d={id:r,thumb_url:thumb_url,vanity:vanity,at:o,rt:s,etid:t,is_follower:c,status:a,is_gold:l},h=Object.assign({},e.integration);h.patreon={...d},e.integration=h,e.save().then(e=>{n(e)})})}else n({thumb_url:thumb_url,vanity:vanity,at:o,rt:s,etid:t})})}):Promise.resolve();i.get("/logout",(e,t)=>{e.logout(),t.clearCookie("etid",{domain:"streamachievements.com"}),t.redirect("http://streamachievements.com/")}),e.exports=i},function(e,t){e.exports=require("axios")},function(e,t){e.exports=require("url")},function(e,t){e.exports=require("patreon")},function(e,t,n){const i=n(4).Router(),o=n(1),s=n(3),r=n(7),a=n(9),c=n(0);let l=n(28),d=n(33);const{isAuthorized:h,isAdminAuthorized:u}=n(6);i.use("/channel",l),i.use("/achievement",d),i.get("/token",o.authenticate("twitch"),(e,t)=>t.json({success:!0,data:e.user.id}));let m=!1;i.get("/users",u,(e,t)=>{a.find({}).then(e=>{let n=e.map(e=>e.uid);s.find({_id:{$in:n}}).then(e=>{let n=e.map(e=>({name:e.name,logo:e.logo}));t.json({users:n})})})}),i.get("/user",h,(e,t)=>{let n;if(setTimeout(()=>{m&&(console.log("timeout"),t.status(500),t.json({message:"Internal Server Issue"}))},1e4),e.user.integration.patreon){let t=e.user.integration.patreon;n={vanity:t.vanity,thumb_url:t.thumb_url,follower:t.is_follower,status:t.status,gold:t.is_gold}}else n=!1;r.findOne({twitchID:e.user.integration.twitch.etid}).then(i=>{if(m=!1,i)t.json({username:e.user.name,logo:e.user.logo,patreon:n,status:"verified",type:e.user.type});else{let i="viewer";console.log(e.user),a.findOne({uid:e.user._id}).then(o=>{console.log(o),o&&(i="not issued"===o.token?"review":"pending"),t.json({username:e.user.name,logo:e.user.logo,patreon:n,status:i,type:e.user.type})})}})}),i.get("/profile",h,(e,t)=>{let n=e.user.channels.map(e=>new c.Types.ObjectId(e.channelID));r.find({_id:{$in:n}}).then(n=>{responseData=n.map(t=>{let n=0,i=e.user.channels.filter(e=>e.channelID===t.id);return 0!==t.achievements.length&&(n=Math.round(i[0].achievements.length/t.achievements.length*100)),{logo:t.logo,owner:t.owner,percentage:n}}),t.json(responseData)})}),e.exports=i},function(e,t,n){const i=n(4).Router(),{isAuthorized:o,isAdminAuthorized:s}=(n(1),n(6)),r=n(0),a=n(2),c=(new(n(5))(a.session.cookieKey),n(29)),l=n(30),d=n(31),h=n(3),u=n(7),m=n(10),p=n(11),g=n(8),f=n(9),{uploadImage:y,destroyImage:v}=n(12),w=/^https:\/\/res\.cloudinary\.com\/phirehero\/.*\.(png|jpg|jpeg)$/gm;i.get("/create",o,(e,t)=>{u.findOne({twitchID:e.user.twitchID}).then(n=>{n?t.json({error:"Channel already exists!",channel:n}):new u({owner:e.user.name,twitchID:e.user.twitchID,theme:"",logo:e.user.logo,achievements:[],members:[]}).save().then(n=>{e.user.channelID=n.id,e.user.save().then(i=>{t.json({channel:n,user:e.user})})})})}),i.post("/leave",o,(e,t)=>{u.findOne({owner:e.body.channel}).then(n=>{if(n){let i,o=n.members;o.length>0&&o.includes(e.user.id)?(i=o.findIndex(t=>{e.user.id}),o.splice(i,1),n.save().then(n=>{i=0,i=e.user.channels.findIndex(e=>e.channelID===n.id),e.user.channels.splice(i,1),e.user.save().then(e=>{t.json({leave:!0})})})):t.send("User isn't a part of this channel")}else t.send("Channel doesn't exist")})}),i.post("/join",o,(e,t)=>{u.findOne({owner:e.body.channel}).then(n=>{if(n){let i=e.user.channels.some(e=>e.channelID===n.id),o=n.members.includes(e.user.id);i?o?t.json({user:e.user,channel:n}):(n.members.push(e.user.id),n.save().then(n=>{t.json({user:e.user,channel:n})})):o?i?t.json({user:e.user,channel:n}):(e.user.channels.push({channelID:n.id,achievements:[]}),e.user.save().then(e=>{t.json({user:e,channel:n})})):(e.user.channels.push({channelID:n.id,achievements:[]}),e.user.save().then(e=>{n.members.push(e.id),n.save().then(n=>{t.json({user:e,channel:n})})}))}else t.status(405),t.send("Channel requested to join does not exist!")})}),i.get("/list",(e,t)=>{u.find({},(e,n)=>{t.json(n)})}),i.get("/retrieve",o,(e,t)=>{let n=e.query.id;e.query.bb&&u.find({watcher:!0}).then(e=>{e.map(e=>({name:e.owner,listeners:e.listeners}))}),n?u.findOne({owner:n}).then(i=>{i?m.find({channel:n}).then(n=>{let o,s,r=i.members.includes(e.user.id);r?(earnedAchievements=e.user.channels.filter(e=>e.channelID===i.id)[0],o=earnedAchievements.achievements.map(e=>e.aid),s=n.map(e=>{let t=Object.assign({},e._doc),n=o.findIndex(e=>e===t.uid);return n>=0&&(t.earned=earnedAchievements.achievements[n].earned),t})):o=[],t.json({channel:i,achievements:s,joined:r})}):t.json({error:"No channel found for the name: "+n})}):u.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{if(e){let n=new Promise((t,n)=>{m.find({channel:e.owner}).then(e=>{if(e){let n=e.map(e=>e.listener);p.find({_id:{$in:n}}).then(n=>{let i=e.map(e=>{let t=n.find(t=>t.id===e.listener);if(t){let n={_id:e._id,uid:e.uid,channel:e.owner,title:e.title,description:e.description,icon:e.icon,earnable:e.earnable,limited:e.limited,secret:e.secret,listener:e.listener,code:t.code};return t.resubType&&(n.resubType=t.resubType),t.query&&(n.query=t.query),n}return e});t(i)})}else t(e)})}),i=new Promise((t,n)=>{g.find({channel:e.owner}).then(e=>{t(e?{gallery:e}:{gallery:[]})})}),o=new Promise((t,n)=>{h.find({_id:{$in:e.members}}).then(n=>{let i=n.map(t=>({name:t.name,logo:t.logo,achievements:t.channels.filter(t=>t.channelID===e.id)[0].achievements}));t(i)})});Promise.all([n,i,o]).then(n=>{t.json({channel:e,achievements:n[0],images:n[1],members:n[2]})})}else t.json({error:"User doesn't manage a channel"})})}),i.post("/update",o,(e,t)=>{u.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{})}),i.post("/preferences",o,(e,t)=>{u.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{let i,o;i=new Promise((t,i)=>{e.body.defaultIcon&&d(e.body.defaultIcon)?y(e.body.defaultIcon,e.body.defaultIconName,n.owner,"default").then(e=>{n.icons=n.icons||{},n.icons.default=e.url,t()}):e.body.defaultImage&&w.test(e.body.defaultImage)?(n.icons=n.icons||{},n.icons.default=e.body.defaultImage,t()):t()}),o=new Promise((t,i)=>{e.body.hiddenIcon&&d(e.body.hiddenIcon)?y(e.body.hiddenIcon,e.body.hiddenIconName,n.owner,"hidden").then(e=>{n.icons=n.icons||{},n.icons.hidden=e.url,t()}):e.body.hiddenImage&&w.test(e.body.hiddenImage)?(n.icons=n.icons||{},n.icons.hidden=e.body.hiddenImage,t()):t()}),Promise.all([i,o]).then(()=>{n.save().then(e=>{console.log(e.icons),g.find({channel:n.owner}).then(n=>{n?t.json({channel:e,images:{gallery:n}}):t.json({channel:e})})})})})}),i.post("/image",o,(e,t)=>{let n=e.body.image;v(n.cloudID).then(i=>{let o,s=new Promise((t,i)=>{""!==n.achievementID?m.findOne({_id:n.achievementID}).then(n=>{n?(n.icon="",n.save().then(()=>{m.find({channel:e.user.name}).then(e=>{t(e)})})):t()}):t()}),r=new Promise((t,i)=>{g.deleteOne({_id:n._id}).then(n=>{g.find({channel:e.user.name}).then(e=>{console.log("\nGetting all images after delete"),t(e?{gallery:e,default:""}:{gallery:[],default:""})})})});o="hidden"===n.type||"default"===n.type?new Promise((t,i)=>{u.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{let i={...e.icons};delete i[n.type],e.icons=i,console.log("hya"),e.save().then(e=>{t(e)})})}):Promise.resolve(),Promise.all([s,r,o]).then(e=>{console.log(e);let n={images:e[1]};e[0]&&(n.achievements=e[0]),e[2]&&(n.channel=e[2]),t.json(n)})})}),i.get("/user",o,(e,t)=>{let n=e.user.channels.map(e=>new r.Types.ObjectId(e.channelID));u.find({_id:{$in:n}}).then(n=>{let i=n.map(t=>{let n=e.user.channels.filter(e=>e.channelID===t.id),i=0;return new Promise((e,o)=>{m.countDocuments({channel:t.owner}).then(o=>{console.log(o),o>0&&(i=Math.round(n[0].achievements.length/o*100)),e({logo:t.logo,owner:t.owner,percentage:i})})})});Promise.all(i).then(e=>{t.json(e)})})}),i.post("/signup",o,(e,t)=>{let n=e.body.uid;f.findOne({uid:n}).then(n=>{if(n)t.json({error:"You have already signed up!"});else{new f({uid:e.user._id,token:"not issued"}).save().then(e=>{t.json({signup:!0})})}})}),i.post("/queue",s,(e,t)=>{let n=e.body.uid;f.deleteOne({uid:n}).then(e=>{h.find({_id:n}).then(e=>{e.email;l.createTransport({service:"gmail",auth:{user:a.gmail.user,pass:a.gmail.password}});a.gmail.user})})}),i.post("/confirm",s,(e,t)=>{h.findOne({name:e.body.name}).then(e=>{let n=e._id;console.log(n),f.findOne({uid:n}).then(e=>{let n=c.randomBytes(16).toString("hex");e.token=n,e.created=Date.now(),e.save().then(e=>{h.find({_id:e.uid}).then(e=>{e.email;var i={type:"oauth2",user:a.gmail.user,clientId:a.gmail.clientID,clientSecret:a.gmail.clientSecret,refreshToken:a.gmail.refreshToken},o=l.createTransport({service:"gmail",auth:i});const s={from:a.gmail.user,to:"phireherottv@gmail.com",subject:"Your Confirmation Code!",html:'<div style="background:#222938;padding-bottom:30px;"><h1 style="text-align:center;background:#2f4882;padding:15px;margin-top:0;"><img style="max-width:600px;" src="https://res.cloudinary.com/phirehero/image/upload/v1557947921/sa-logo.png" /></h1><h2 style="color:#FFFFFF; text-align: center;margin-top:30px;margin-bottom:25px;font-size:22px;">Thank you for your interest in Stream Achievements!</h2><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We reviewed your channel and feel you are a perfect fit to join in on this pilot, and test the new features we aim to provide for streamers!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">To get started, all you need to do is <a style="color: #ecdc19;" href="http://streamachievements.com/channel/verify?id='+n+'&utm_medium=Email">verify your account</a>, and you\'ll be all set!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We are truly excited to see what you bring in terms of Achievements, and can\'t wait to see how much your community engages!</p></div>'};o.sendMail(s,function(e,n){e?console.log(e):t.json({message:"email sent"})})})})})})}),i.post("/verify",o,(e,t)=>{let n=e.body.id;console.log(e.user._id),console.log(n),f.findOne({uid:e.user._id,token:n}).then(n=>{n?(console.log(n),n.hasExpired()?t.json({expired:!0}):new u({owner:e.user.name,twitchID:e.user.integration.twitch.etid,theme:"",logo:e.user.logo,achievements:[],members:[]}).save().then(n=>{e.user.channelID=n.id,e.user.save().then(e=>{t.json({verified:!0})})})):t.json({error:"Unauthorized"})})}),e.exports=i},function(e,t){e.exports=require("crypto")},function(e,t){e.exports=require("nodemailer")},function(e,t){e.exports=require("valid-data-url")},function(e,t){e.exports=require("cloudinary")},function(e,t,n){const i=n(4).Router(),o=(n(1),n(3)),s=n(7),r=n(10),a=n(11),c=n(34),l=n(35),d=n(8),{isAuthorized:h}=n(6),u=n(12).uploadImage;n(0);let m=(e,t)=>{let n={_id:e._id,channel:e.owner,title:e.title,description:e.description,icon:e.icon,earnable:e.earnable,limited:e.limited,secret:e.secret,listener:e.listener,code:t.code};return t.resubType&&(n.resubType=t.resubType),t.query&&(n.query=t.query),n},p=(e,t,n,i)=>new Promise((o,s)=>{let c;(c=i?new Promise((t,n)=>{d.findOne({achievementID:e._id}).then(n=>{n?(n.achievementID="",n.save().then(()=>{i.achievementID=e._id,i.save().then(e=>{t()})})):(i.achievementID=e._id,i.save().then(e=>{t()}))})}):Promise.resolve()).then(()=>{r.findOneAndUpdate({_id:e._id},{$set:t},{new:!0}).then(e=>{Object.keys(n).length>0?a.findOneAndUpdate({_id:e.listener},{$set:n},{new:!0}).then(t=>{let n=m(e,t);o({update:!0,achievement:n})}):a.findOne({_id:e.listener}).then(t=>{let n=m(e,t);o({update:!0,achievement:n})})})})}),g=e=>new Promise((t,n)=>{d.find({channel:e,type:"achievement"}).then(e=>{if(e){let n={active:[],inactive:[]};e.map(e=>{e.achievementID&&""!==e.achievementID?n.active.push(e):n.inactive.push(e)}),t(n.active.concat(n.inactive))}else t([])})});i.post("/update",h,(e,t)=>{s.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{n?r.findOne({_id:e.body.id,channel:n.owner}).then(i=>{if(i){let o=e.body,{code:s,resubType:r,query:a,bot:c,condition:l}=o,d={};s&&(d.code=s,delete o.code),r&&(d.resubType=r,delete o.resubType),a&&(d.query=a,delete o.query),c&&(d.bot=c,delete o.bot),l&&(d.condition=l,delete o.condition),o.icon&&o.iconName?u(o.icon,o.iconName,n.owner).then(e=>{o.icon=e.url,p(i,o,d,e).then(e=>{t.json(e)})}):p(i,o,d).then(e=>{t.json(e)})}else t.json({update:!1,message:"The achievement you tried to update doesn't exist!"})}):t.json({update:!1,message:"The channel you tried to update the achievement for doesn't exist!"})})}),i.post("/create",h,(e,t)=>{s.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{if(n){let i={};e.body.id?i._id=e.body.id:i.title=e.body.title,i.channel=n.owner,r.findOne(i).then(i=>{i?t.json({created:!1,message:"An achievement with this name already exists!",achievement:i}):r.count().then(i=>{let o={uid:i+1,channel:n.owner,title:e.body.title,description:e.body.description,icon:e.body.icon,earnable:e.body.earnable,limited:e.body.limited,secret:e.body.secret,listener:e.body.listener},s={channel:n.owner,code:e.body.code};"0"!==s.code&&(s.query=e.body.query,"1"===s.code&&(s.resubType=parseInt(e.body.resubType)),"4"===s.code&&(s.bot=e.body.bot,s.condition=e.body.condition)),a.findOne(s).then(i=>{i?r.findOne({listener:i._id}).then(e=>{t.json({created:!1,message:'The conditions you selected are already taken by the "'+e.title+'" achievement!'})}):e.body.icon?u(e.body.icon,e.body.iconName,n.owner).then(e=>{o.icon=e.url,new r(o).save().then(n=>{console.log("new achievement in DB"),s.achievement=n.id,new a(s).save().then(i=>{console.log("new listener in DB"),n.listener=i.id,n.save().then(n=>{e.achievementID=n.id,e.save().then(e=>{t.json({created:!0,achievement:n})})})})})}):new r(o).save().then(e=>{console.log("new achievement in DB"),s.achievement=e.id,new a(s).save().then(n=>{console.log("new listener in DB"),e.listener=n.id,e.save().then(e=>{t.json({created:!0,achievement:e})})})})})})})}else t.json({created:!1,message:"This channel you are creating for doesn't exist!"})})}),i.post("/delete",h,(e,t)=>{s.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{if(n){let i={};i._id=e.body.achievementID,i.channel=n.owner,r.findOne(i).then(e=>{if(e){let n=e.listener;r.deleteOne(i).then(i=>{let o={_id:n,channel:e.channel};a.findOne(o).then(e=>{e?a.deleteOne(o).then(e=>{t.json({deleted:!0})}):t.json({deleted:!0})})})}else t.json({deleted:!1,message:"The achievement you requested to delete doesn't exist!"})})}else t.json({delete:!1,message:"This channel you are deleting for doesn't exist!"})})}),i.get("/retrieve",h,(e,t)=>{let n=e.user.name,i=e.query.aid;i?s.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{if(e){let n=new Promise((t,n)=>{r.findOne({uid:i,channel:e.owner}).then(e=>{if(e){e.listener;a.findOne({_id:e.listener,channel:e.channel}).then(n=>{if(n){let i=Object.assign({},n._doc),o=Object.assign({},e._doc);delete i._id;let s=Object.assign(o,i);t(s)}else t(e)})}else t(null)})}),o=g(e.owner);Promise.all([n,o]).then(n=>{t.json({achievement:n[0],images:n[1],defaultIcons:e.icons})})}else t.json({error:"User isn't a verified channel owner"})}):n&&r.find({channel:n}).then(e=>{if(e){let n=e.map(e=>e.listener);a.find({_id:{$in:n}}).then(n=>{e.forEach(e=>{let t=n.find(t=>t._id=e.listener);return delete t._id,Object.assign(e,t)}),t.json(e)})}else t.json(e)})}),i.post("/award",h,(e,t)=>{let n=e.body.members,i=e.body.aid;s.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{o.find({name:{$in:n}}).then(n=>{let s=n.map((t,n)=>{let o=t.channels,s=o.findIndex(t=>t.channelID===e.id);return o[s].achievements.push({aid:i,earned:Date.now()}),t.channels=o,console.log(t.channels[0].achievements),t.save().then(e=>{console.log(e.channels[0].achievements)})});Promise.all(s).then(n=>{o.find({_id:{$in:e.members}}).then(n=>{let i=n.map(t=>({name:t.name,logo:t.logo,achievements:t.channels.filter(t=>t.channelID===e.id)[0].achievements}));t.json({members:i})})})})})}),i.get("/icons",h,(e,t)=>{s.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{e?g(e.owner).then(n=>{t.json({images:n,defaultIcons:e.icons})}):t.json({error:!0})})}),i.get("/listeners",(e,t)=>{console.log("/achievement/listeners");let n=e.query.channel;Array.isArray(n)||(n=n.split(",")),console.log(n),a.find({channel:{$in:n}}).then(e=>{e.length>0?t.json(e):t.json([])})}),i.post("/listeners",(e,t)=>{console.log("achievements to process..."),console.log(e.body);let n=e.body,i=new Date;n.forEach(e=>{let{channel:n,achievement:r,tier:a,userID:d}=e;o.findOne({"integration.twitch.etid":d}).then(e=>{e?s.find({owner:n}).then(n=>{let o=e.channels.findIndex(e=>e.channelID===n._id);o>=0?e.channels[o].achievements.includes(r.achievementID)?t.json({message:"This user already earned this achievement!"}):e.channels[o].achievements.push({id:r.achievementID,earned:i}):(e.channels.push({channelID:n._id,achievements:[{id:r.achievementID,earned:i}]}),e.save().then(e=>{new l({twitchID:d,channelID:n._id,achievementID:r.achievementID}).save().then(e=>{t.json({message:"Achievement has been awarded!"})})}))}):s.find({owner:n}).then(e=>{new c({twitchID:d,channelID:e._id,achievementID:r.achievementID}).save().then(e=>{t.json({message:"User hasn't signed up yet, but their achievement earning is stored!"})})})})})}),e.exports=i},function(e,t,n){const i=n(0),o=new(0,i.Schema)({twitchID:String,channelID:String,achievement:String}),s=i.model("queue",o);e.exports=s},function(e,t,n){const i=n(0),o=new(0,i.Schema)({twitchID:String,channelID:String,achievementID:String}),s=i.model("notice",o);e.exports=s}]);