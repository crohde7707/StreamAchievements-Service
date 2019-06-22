!function(e){var t={};function n(i){if(t[i])return t[i].exports;var o=t[i]={i:i,l:!1,exports:{}};return e[i].call(o.exports,o,o.exports,n),o.l=!0,o.exports}n.m=e,n.c=t,n.d=function(e,t,i){n.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:i})},n.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},n.t=function(e,t){if(1&t&&(e=n(e)),8&t)return e;if(4&t&&"object"==typeof e&&e&&e.__esModule)return e;var i=Object.create(null);if(n.r(i),Object.defineProperty(i,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)n.d(i,o,function(t){return e[t]}.bind(null,o));return i},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=12)}([function(e,t){e.exports=require("mongoose")},function(e,t,n){const i=n(0),o=new(0,i.Schema)({name:String,twitchID:String,logo:String,email:String,type:String,channels:[{channelID:String,achievements:[{aid:Number,earned:Date}]}],integration:Object,lastLogin:Date}),s=i.model("user",o);e.exports=s},function(e,t){e.exports=require("express")},function(e,t){e.exports=require("passport")},function(e,t){e.exports=require("cryptr")},function(e,t,n){const i=n(1),o=new(n(4))(process.env.SCK);e.exports={authCheck:(e,t,n)=>{e.user?n():t.redirect("/auth/twitch")},isAuthorized:async(e,t,n)=>{let s=o.decrypt(e.cookies.etid),r=await i.findOne({"integration.twitch.etid":s});r?(e.user=r,t.cookie("etid",e.cookies.etid,{maxAge:864e5,httpOnly:!1,domain:"streamachievements.com"}),n()):(t.clearCookie("etid"),t.status(401),t.redirect("http://streamachievements.com"))},isAdminAuthorized:async(e,t,n)=>{let s=o.decrypt(e.cookies.etid),r=await i.findOne({"integration.twitch.etid":s});r&&(r.type="admin")?(t.user=r,t.cookie("etid",e.cookies.etid,{maxAge:864e5,httpOnly:!1,domain:"streamachievements.com"}),n()):(t.status(401),t.json({message:"You are not authorized to make this request."}),n())}}},function(e,t,n){const i=n(0),o=new(0,i.Schema)({owner:String,twitchID:String,theme:String,logo:String,achievements:Array,members:Array,icons:{default:String,hidden:String}}),s=i.model("channel",o);e.exports=s},function(e,t,n){const i=n(0);var o=new(0,i.Schema)({uid:String,token:String,created:Date});o.methods.hasExpired=function(){return Date.now()-Date.parse(this.created)>2592e5};const s=i.model("token",o);e.exports=s},function(e,t,n){const i=n(0),o=new(0,i.Schema)({name:String,type:String,channel:String,cloudID:String,url:String,achievementID:String}),s=i.model("image",o);e.exports=s},function(e,t,n){const i=n(0),o=new(0,i.Schema)({uid:Number,channel:String,title:String,description:String,icon:String,earnable:Boolean,limited:Boolean,secret:Boolean,listener:String,first:String,earned:Date}),s=i.model("achievement",o);e.exports=s},function(e,t,n){const i=n(0),o=i.Schema,s=new o({channel:String,code:String,type:String,bot:String,query:o.Types.Mixed,condition:String,achievement:String}),r=i.model("listener",s);e.exports=r},function(e,t,n){const i=n(8);let o=n(32).v2;o.config({cloud_name:process.env.CLDNAME,api_key:process.env.CLDKEY,api_secret:process.env.CLDS});e.exports={uploadImage:(e,t,n,s)=>{return new Promise((r,a)=>{i.findOne({name:t,channel:n}).then(l=>{l?(console.log("\nimage already exists"),r(l)):(console.log("\nnew image"),o.uploader.upload(e,(e,o)=>{e?(console.log(e),a({error:e})):(console.log("\nimage uploaded successfully"),new i({name:t,channel:n,cloudID:o.public_id,url:o.url,type:s||"achievement"}).save().then(e=>{console.log("new image in DB"),r(e)}))}))})})},destroyImage:e=>new Promise((t,n)=>{o.uploader.destroy(e,function(e){t(e)})})}},function(e,t,n){e.exports=n(13)},function(e,t,n){(function(t){const i=n(2),o=n(14),s=n(0),r=n(15),a=n(3),l=(n(16),n(18)),c=n(19),d=n(20).refreshCookie,h=n(21).allowAccess;let u=e.exports.io=n(22),m=n(23),p=n(27);const g=process.env.PORT||5e3;let f=i();f.set("view engine","ejs"),f.use(l()),f.use(c({limit:"50mb",extended:!0})),s.connect(process.env.MDB,{useNewUrlParser:!0},()=>{console.log("connected to mongodb")}),f.use(r({name:"e2tid",maxAge:1e3,keys:process.env.SCK,cookie:{httpOnly:!0,expires:new Date(Date.now()+36e5)}})),f.use(a.initialize()),f.use(a.session()),f.use(i.static("public")),f.use("/auth",[h,d],m),f.use("/api",[h,d],p),f.use(i.static(o.join(t,"client/build")));f.listen(g);u.listen(process.env.IRC_WS_PORT),u.on("connection",function(e){console.log("connected:",e.client.id),e.emit("new-channel","phirehero has joined the frey"),console.log("message sent to IRC")}),console.log(`Express app listening on port ${g}`)}).call(this,"/")},function(e,t){e.exports=require("path")},function(e,t){e.exports=require("cookie-session")},function(e,t,n){const i=n(3),o=n(17).Strategy,s=n(1),r=new(n(4))(process.env.SCK);i.serializeUser((e,t)=>{t(null,e)}),i.use(new o({clientID:process.env.TCID,clientSecret:process.env.TCS,callbackURL:process.env.TPR},(e,t,n,i)=>{let o=r.encrypt(e),a=r.encrypt(t),l={etid:n.id.toString(),token:o,refresh:a};s.findOne({"integration.twitch.etid":l.etid}).then(e=>{e?(e.integration.twitch=l,e.name!==n.username&&(e.name=n.username),e.logo!==n._json.logo&&(e.logo=n._json.logo),e.email!==n.email&&(e.email=n.email),e.save().then(t=>{console.log("found user, logging in..."),i(null,e)})):new s({name:n.username,logo:n._json.logo,email:n.email,type:"user",channels:[],integration:{twitch:l}}).save().then(e=>{i(null,e)})})}))},function(e,t){e.exports=require("passport-twitch")},function(e,t){e.exports=require("cookie-parser")},function(e,t){e.exports=require("body-parser")},function(e,t){e.exports={refreshCookie:async(e,t,n)=>{console.log(e.session),e.session.fake=Date.now(),n()}}},function(e,t,n){e.exports={allowAccess:async(e,t,n)=>{var i;i=["http://www.streamachievements.com","http://streamachievements.com","https://www.streamachievements.com","https://streamachievements.com"];var o=e.headers.origin;i.indexOf(o)>-1&&t.setHeader("Access-Control-Allow-Origin",o),t.header("Access-Control-Allow-Credentials",!0),t.header("Access-Control-Allow-Headers","Origin, X-Requested-With, Content-Type, Accept"),n()}}},function(e,t){e.exports=require("socket.io")},function(e,t,n){const i=n(2).Router(),o=n(3),s=n(4),r=n(24),a=new s(process.env.SCK),l=n(5).isAuthorized;n(1);n(25);let c=n(26),d=c.patreon,h=(0,c.oauth)(process.env.PCID,process.env.PCS);const u="https://www.patreon.com/api/oauth2/v2/identity?include=memberships&fields%5Buser%5D=thumb_url,vanity";i.get("/twitch",o.authenticate("twitch",{scope:["user_read"]})),i.get("/twitch/redirect",o.authenticate("twitch"),(e,t)=>{e.session.user=e.user;let n=a.encrypt(e.user.integration.twitch.etid);t.cookie("etid",n,{maxAge:144e5,httpOnly:!1,domain:"streamachievements.com"});let i=e.user.integration.patreon;if(i&&"lifetime"!==i.status){let n=i.id,o=a.decrypt(i.at);console.log(o),console.log(i),r.get(`https://www.patreon.com/api/oauth2/v2/members/${n}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`,{headers:{Authorization:`Bearer ${o}`}}).then(n=>{let o=n.data.data.attributes.patron_status,s=n.data.data.attributes.is_follower,r=n.data.data.relationships.currently_entitled_tiers.data.map(e=>e.id).indexOf("3497710")>=0,a={id:i.id,thumb_url:i.thumb_url,vanity:i.vanity,at:i.at,rt:i.rt,is_follower:s,status:o,is_gold:r},l=Object.assign({},e.user.integration);l.patreon={...a},e.user.integration=l,e.user.lastLogin=Date.now(),e.user.save().then(e=>{t.redirect(process.env.WEB_DOMAIN+"home")})})}else e.user.lastLogin=Date.now(),e.user.save().then(e=>{t.redirect(process.env.WEB_DOMAIN+"home")})}),i.get("/patreon",l,(e,t)=>{let n="https://www.patreon.com/oauth2/authorize?";n+="response_type=code&",n+="client_id="+process.env.PCID+"&",n+="redirect_uri="+process.env.PPR,n+="&scope=campaigns%20identity%20identity%5Bemail%5D%20campaigns.members",t.redirect(n)}),i.get("/patreon/redirect",l,(e,t)=>{let n=e.query.code;return h.getTokens(n,process.env.PPR).then(t=>{d(t.access_token);let n=e.cookies.etid;return new Promise((e,i)=>{let o,s,l=a.encrypt(t.access_token),c=a.encrypt(t.refresh_token);r.get(u,{headers:{Authorization:`Bearer ${t.access_token}`}}).then(i=>{if(o=i.data.data.attributes.vanity,s=i.data.data.attributes.thumb_url,i.data.included){let a=i.data.included[0].id;r.get(`https://www.patreon.com/api/oauth2/v2/members/${a}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`,{headers:{Authorization:`Bearer ${t.access_token}`}}).then(t=>{let i=t.data.data.attributes.patron_status,r=t.data.data.attributes.is_follower,d=t.data.data.relationships.currently_entitled_tiers.data.map(e=>e.id).indexOf("3497710")>=0;e({id:a,thumb_url:s,vanity:o,at:l,rt:c,etid:n,is_follower:r,status:i,is_gold:d})})}else e({thumb_url:s,vanity:o,at:l,rt:c,etid:n})})})}).then(n=>{let{id:i,thumb_url:o,vanity:s,at:r,rt:a,etid:l,is_follower:c,status:d,is_gold:h}=n,u=Object.assign({},e.user.integration);u.patreon={id:i,thumb_url:o,vanity:s,at:r,rt:a,is_follower:c,status:d,is_gold:h},e.user.integration=u,e.user.save().then(e=>{t.redirect("http://streamachievements.com/profile")})})}),i.post("/patreon/sync",l,(e,t)=>{m(e.user,e.cookies.etid).then(e=>{t.json(e)})});let m=(e,t)=>e.integration.patreon?new Promise((n,i)=>{let{at:o,rt:s,id:l}=e.integration.patreon,c=a.decrypt(o);r.get(u,{headers:{Authorization:`Bearer ${c}`}}).then(i=>{if(vanity=i.data.data.attributes.vanity,thumb_url=i.data.data.attributes.thumb_url,i.data.included){let a=i.data.included[0].id;r.get(`https://www.patreon.com/api/oauth2/v2/members/${a}?include=currently_entitled_tiers&fields%5Bmember%5D=patron_status,full_name,is_follower,last_charge_date&fields%5Btier%5D=amount_cents,description,discord_role_ids,patron_count,published,published_at,created_at,edited_at,title,unpublished_at`,{headers:{Authorization:`Bearer ${c}`}}).then(i=>{let r=i.data.data.attributes.patron_status,l=i.data.data.attributes.is_follower,c=i.data.data.relationships.currently_entitled_tiers.data.map(e=>e.id).indexOf("3497710")>=0,d={id:a,thumb_url:thumb_url,vanity:vanity,at:o,rt:s,etid:t,is_follower:l,status:r,is_gold:c},h=Object.assign({},e.integration);h.patreon={...d},e.integration=h,e.save().then(e=>{n({vanity:e.integration.patreon.vanity,thumb_url:e.integration.patreon.thumb_url,follower:e.integration.patreon.is_follower,status:e.integration.patreon.status,gold:e.integration.patreon.is_gold})})})}else n({thumb_url:thumb_url,vanity:vanity,at:o,rt:s,etid:t})})}):Promise.resolve();i.get("/logout",(e,t)=>{e.logout(),t.clearCookie("etid",{domain:"streamachievements.com"}),t.redirect(process.env.WEB_DOMAIN)}),e.exports=i},function(e,t){e.exports=require("axios")},function(e,t){e.exports=require("url")},function(e,t){e.exports=require("patreon")},function(e,t,n){const i=n(2).Router(),o=n(3),s=n(1),r=n(6),a=n(7),l=n(0);let c=n(28),d=n(33),h=n(36);const{isAuthorized:u,isAdminAuthorized:m}=n(5);i.use("/channel",c),i.use("/achievement",d),i.use("/irc",h),i.get("/token",o.authenticate("twitch"),(e,t)=>t.json({success:!0,data:e.user.id}));let p=!1;i.get("/users",m,(e,t)=>{a.find({}).then(e=>{let n=e.map(e=>e.uid);s.find({_id:{$in:n}}).then(e=>{let n=e.map(e=>({name:e.name,logo:e.logo}));t.json({users:n})})})}),i.get("/user",u,(e,t)=>{let n;if(setTimeout(()=>{p&&(console.log("timeout"),t.status(500),t.json({message:"Internal Server Issue"}))},1e4),e.user.integration.patreon){let t=e.user.integration.patreon;n={vanity:t.vanity,thumb_url:t.thumb_url,follower:t.is_follower,status:t.status,gold:t.is_gold}}else n=!1;r.findOne({twitchID:e.user.integration.twitch.etid}).then(i=>{if(p=!1,i)t.json({username:e.user.name,logo:e.user.logo,patreon:n,status:"verified",type:e.user.type});else{let i="viewer";console.log(e.user),a.findOne({uid:e.user._id}).then(o=>{console.log(o),o&&(i="not issued"===o.token?"review":"pending"),t.json({username:e.user.name,logo:e.user.logo,patreon:n,status:i,type:e.user.type})})}})}),i.get("/profile",u,(e,t)=>{let n=e.user.channels.map(e=>new l.Types.ObjectId(e.channelID));r.find({_id:{$in:n}}).then(n=>{responseData=n.map(t=>{let n=0,i=e.user.channels.filter(e=>e.channelID===t.id);return 0!==t.achievements.length&&(n=Math.round(i[0].achievements.length/t.achievements.length*100)),{logo:t.logo,owner:t.owner,percentage:n}}),t.json(responseData)})}),e.exports=i},function(e,t,n){const i=n(2).Router(),{isAuthorized:o,isAdminAuthorized:s}=(n(3),n(5)),r=n(0),a=(new(n(4))(process.env.SCK),n(29)),l=n(30),c=n(31),d=n(1),h=n(6),u=n(9),m=n(10),p=n(8),g=n(7),{uploadImage:f,destroyImage:v}=n(11),y="https://res.cloudinary.com/phirehero/image/upload/v1558811694/default-icon.png",w="https://res.cloudinary.com/phirehero/image/upload/v1558811887/hidden-icon.png",b=/^https:\/\/res\.cloudinary\.com\/phirehero\/.*\.(png|jpg|jpeg)$/gm;i.get("/create",o,(e,t)=>{h.findOne({twitchID:e.user.twitchID}).then(n=>{n?t.json({error:"Channel already exists!",channel:n}):new h({owner:e.user.name,twitchID:e.user.twitchID,theme:"",logo:e.user.logo,achievements:[],members:[],icons:{default:y,hidden:w}}).save().then(n=>{e.user.channelID=n.id,e.user.save().then(i=>{t.json({channel:n,user:e.user})})})})}),i.post("/leave",o,(e,t)=>{h.findOne({owner:e.body.channel}).then(n=>{if(n){let i,o=n.members;o.length>0&&o.includes(e.user.id)?(i=o.findIndex(t=>{e.user.id}),o.splice(i,1),n.save().then(n=>{i=0,i=e.user.channels.findIndex(e=>e.channelID===n.id),e.user.channels.splice(i,1),e.user.save().then(e=>{t.json({leave:!0})})})):t.send("User isn't a part of this channel")}else t.send("Channel doesn't exist")})}),i.post("/join",o,(e,t)=>{h.findOne({owner:e.body.channel}).then(n=>{if(n){let i=e.user.channels.some(e=>e.channelID===n.id),o=n.members.includes(e.user.id);i?o?t.json({user:e.user,channel:n}):(n.members.push(e.user.id),n.save().then(n=>{t.json({user:e.user,channel:n})})):o?i?t.json({user:e.user,channel:n}):(e.user.channels.push({channelID:n.id,achievements:[]}),e.user.save().then(e=>{t.json({user:e,channel:n})})):(e.user.channels.push({channelID:n.id,achievements:[]}),e.user.save().then(e=>{n.members.push(e.id),n.save().then(n=>{t.json({user:e,channel:n})})}))}else t.status(405),t.send("Channel requested to join does not exist!")})}),i.get("/list",(e,t)=>{h.find({},(e,n)=>{t.json(n)})}),i.get("/retrieve",o,(e,t)=>{let n=e.query.id;e.query.bb&&h.find({watcher:!0}).then(e=>{e.map(e=>({name:e.owner,listeners:e.listeners}))}),n?h.findOne({owner:n}).then(i=>{i?u.find({channel:n}).then(n=>{let o,s,r=i.members.includes(e.user.id);r?(earnedAchievements=e.user.channels.filter(e=>e.channelID===i.id)[0],o=earnedAchievements.achievements.map(e=>e.aid),s=n.map(e=>{let t=Object.assign({},e._doc),n=o.findIndex(e=>e===t.uid);return n>=0&&(t.earned=earnedAchievements.achievements[n].earned),t})):s=n,t.json({channel:i,achievements:s,joined:r})}):t.json({error:"No channel found for the name: "+n})}):h.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{if(e){let n=new Promise((t,n)=>{u.find({channel:e.owner}).then(e=>{if(e){let n=e.map(e=>e.listener);m.find({_id:{$in:n}}).then(n=>{let i=e.map(e=>{let t=n.find(t=>t.id===e.listener);if(t){let n={_id:e._id,uid:e.uid,channel:e.owner,title:e.title,description:e.description,icon:e.icon,earnable:e.earnable,limited:e.limited,secret:e.secret,listener:e.listener,code:t.code};return t.resubType&&(n.resubType=t.resubType),t.query&&(n.query=t.query),n}return e});t(i)})}else t(e)})}),i=new Promise((t,n)=>{p.find({channel:e.owner}).then(e=>{t(e?{gallery:e}:{gallery:[]})})}),o=new Promise((t,n)=>{d.find({_id:{$in:e.members}}).then(n=>{let i=n.map(t=>({name:t.name,logo:t.logo,achievements:t.channels.filter(t=>t.channelID===e.id)[0].achievements}));t(i)})});Promise.all([n,i,o]).then(n=>{t.json({channel:e,achievements:n[0],images:n[1],members:n[2]})})}else t.json({error:"User doesn't manage a channel"})})}),i.post("/update",o,(e,t)=>{h.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{})}),i.post("/preferences",o,(e,t)=>{h.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{let i,o;console.log(e.body),i=new Promise((t,i)=>{e.body.defaultIcon&&c(e.body.defaultIcon)?f(e.body.defaultIcon,e.body.defaultIconName,n.owner,"default").then(e=>{t(e.url)}):e.body.defaultImage&&b.test(e.body.defaultImage)?(console.log("successful match"),t(e.body.defaultImage)):t()}),o=new Promise((t,i)=>{e.body.hiddenIcon&&c(e.body.hiddenIcon)?f(e.body.hiddenIcon,e.body.hiddenIconName,n.owner,"hidden").then(e=>{t(e.url)}):e.body.hiddenImage&&b.test(e.body.hiddenImage)?t(e.body.hiddenImage):t()}),Promise.all([i,o]).then(e=>{let i={default:n.icons.default,hidden:n.icons.hidden};e[0]&&(i.default=e[0]),e[1]&&(i.hidden=e[1]),n.icons=i,n.save().then(i=>{e[0]!==i.icons.default&&console.log("uh oh"),p.find({channel:n.owner}).then(e=>{e?t.json({channel:i,images:{gallery:e}}):t.json({channel:i})})})})})}),i.post("/image",o,(e,t)=>{let n=e.body.image;v(n.cloudID).then(i=>{let o,s=new Promise((t,i)=>{""!==n.achievementID?u.findOne({_id:n.achievementID}).then(n=>{n?(n.icon="",n.save().then(()=>{u.find({channel:e.user.name}).then(e=>{t(e)})})):t()}):t()}),r=new Promise((t,i)=>{p.deleteOne({_id:n._id}).then(n=>{p.find({channel:e.user.name}).then(e=>{console.log("\nGetting all images after delete"),t(e?{gallery:e,default:""}:{gallery:[],default:""})})})});o="hidden"===n.type||"default"===n.type?new Promise((t,i)=>{h.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{let i={...e.icons};"default"===n.type?i.default=y:"hidden"===n.type&&(i.hidden=w),e.icons=i,e.save().then(e=>{t(e)})})}):Promise.resolve(),Promise.all([s,r,o]).then(e=>{console.log(e);let n={images:e[1]};e[0]&&(n.achievements=e[0]),e[2]&&(n.channel=e[2]),t.json(n)})})}),i.get("/user",o,(e,t)=>{let n=e.user.channels.map(e=>new r.Types.ObjectId(e.channelID));h.find({_id:{$in:n}}).then(n=>{let i=n.map(t=>{let n=e.user.channels.filter(e=>e.channelID===t.id),i=0;return new Promise((e,o)=>{u.countDocuments({channel:t.owner}).then(o=>{console.log(o),o>0&&(i=Math.round(n[0].achievements.length/o*100)),e({logo:t.logo,owner:t.owner,percentage:i})})})});Promise.all(i).then(e=>{t.json(e)})})}),i.post("/signup",o,(e,t)=>{let n=e.body.uid;g.findOne({uid:n}).then(n=>{if(n)t.json({error:"You have already signed up!"});else{new g({uid:e.user._id,token:"not issued"}).save().then(e=>{t.json({signup:!0})})}})}),i.post("/queue",s,(e,t)=>{let n=e.body.uid;g.deleteOne({uid:n}).then(e=>{d.find({_id:n}).then(e=>{e.email;l.createTransport({service:"gmail",auth:{user:process.env.GML,pass:process.env.GMLP}});process.env.GML})})}),i.post("/confirm",s,(e,t)=>{d.findOne({name:e.body.name}).then(e=>{let n=e._id;console.log(n),g.findOne({uid:n}).then(e=>{let n=a.randomBytes(16).toString("hex");e.token=n,e.created=Date.now(),e.save().then(e=>{d.find({_id:e.uid}).then(e=>{let i=e.email;var o={type:"oauth2",user:process.env.GML,clientId:process.env.GMLCID,clientSecret:process.env.GMLCS,refreshToken:process.env.GMLRT},s=l.createTransport({service:"gmail",auth:o});const r={from:process.env.GML,to:i,subject:"Your Confirmation Code!",html:'<div style="background:#222938;padding-bottom:30px;"><h1 style="text-align:center;background:#2f4882;padding:15px;margin-top:0;"><img style="max-width:600px;" src="https://res.cloudinary.com/phirehero/image/upload/v1557947921/sa-logo.png" /></h1><h2 style="color:#FFFFFF; text-align: center;margin-top:30px;margin-bottom:25px;font-size:22px;">Thank you for your interest in Stream Achievements!</h2><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We reviewed your channel and feel you are a perfect fit to join in on this pilot, and test the new features we aim to provide for streamers!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">To get started, all you need to do is <a style="color: #ecdc19;" href="http://streamachievements.com/channel/verify?id='+n+'&utm_medium=Email">verify your account</a>, and you\'ll be all set!</p><p style="color:#FFFFFF;font-weight:bold;font-size:16px; text-align: center;">We are truly excited to see what you bring in terms of Achievements, and can\'t wait to see how much your community engages!</p></div>'};s.sendMail(r,function(e,n){e?console.log(e):t.json({message:"email sent"})})})})})})}),i.post("/verify",o,(e,t)=>{let n=e.body.id;console.log(e.user._id),console.log(n),g.findOne({uid:e.user._id,token:n}).then(i=>{i?(console.log(i),i.hasExpired()?t.json({expired:!0}):new h({owner:e.user.name,twitchID:e.user.integration.twitch.etid,theme:"",logo:e.user.logo,achievements:[],members:[]}).save().then(i=>{e.user.channelID=i.id,e.user.save().then(i=>{g.deleteOne({uid:e.user._id,token:n}).then(e=>{t.json({verified:!0})})})})):t.json({error:"Unauthorized"})})}),e.exports=i},function(e,t){e.exports=require("crypto")},function(e,t){e.exports=require("nodemailer")},function(e,t){e.exports=require("valid-data-url")},function(e,t){e.exports=require("cloudinary")},function(e,t,n){const i=n(2).Router(),o=(n(3),n(1)),s=n(6),r=n(9),a=n(10),l=n(34),c=n(35),d=n(8),{isAuthorized:h}=n(5),u=n(11).uploadImage;n(0);let m=(e,t)=>{let n={_id:e._id,channel:e.owner,title:e.title,description:e.description,icon:e.icon,earnable:e.earnable,limited:e.limited,secret:e.secret,listener:e.listener,code:t.code};return t.resubType&&(n.resubType=t.resubType),t.query&&(n.query=t.query),n},p=(e,t,n,i)=>new Promise((o,s)=>{let l;(l=i?new Promise((t,n)=>{d.findOne({achievementID:e._id}).then(n=>{n?(n.achievementID="",n.save().then(()=>{i.achievementID=e._id,i.save().then(e=>{t()})})):(i.achievementID=e._id,i.save().then(e=>{t()}))})}):Promise.resolve()).then(()=>{r.findOneAndUpdate({_id:e._id},{$set:t},{new:!0}).then(e=>{Object.keys(n).length>0?a.findOneAndUpdate({_id:e.listener},{$set:n},{new:!0}).then(t=>{let n=m(e,t);o({update:!0,achievement:n})}):a.findOne({_id:e.listener}).then(t=>{let n=m(e,t);o({update:!0,achievement:n})})})})}),g=e=>new Promise((t,n)=>{d.find({channel:e,type:"achievement"}).then(e=>{if(e){let n={active:[],inactive:[]};e.map(e=>{e.achievementID&&""!==e.achievementID?n.active.push(e):n.inactive.push(e)}),t(n.active.concat(n.inactive))}else t([])})});i.post("/update",h,(e,t)=>{s.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{n?r.findOne({_id:e.body.id,channel:n.owner}).then(i=>{if(i){let o=e.body,{code:s,resubType:r,query:a,bot:l,condition:c}=o,d={};s&&(d.code=s,delete o.code),r&&(d.resubType=r,delete o.resubType),a&&(d.query=a,delete o.query),l&&(d.bot=l,delete o.bot),c&&(d.condition=c,delete o.condition),o.icon&&o.iconName?u(o.icon,o.iconName,n.owner).then(e=>{o.icon=e.url,p(i,o,d,e).then(e=>{t.json(e)})}):p(i,o,d).then(e=>{t.json(e)})}else t.json({update:!1,message:"The achievement you tried to update doesn't exist!"})}):t.json({update:!1,message:"The channel you tried to update the achievement for doesn't exist!"})})}),i.post("/create",h,(e,t)=>{s.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{if(n){let i={};e.body.id?i._id=e.body.id:i.title=e.body.title,i.channel=n.owner,r.findOne(i).then(i=>{i?t.json({created:!1,message:"An achievement with this name already exists!",achievement:i}):r.count().then(i=>{let o={uid:i+1,channel:n.owner,title:e.body.title,description:e.body.description,icon:e.body.icon,earnable:e.body.earnable,limited:e.body.limited,secret:e.body.secret,listener:e.body.listener},s={channel:n.owner,code:e.body.code};"0"!==s.code&&(s.query=e.body.query,"1"===s.code&&(s.resubType=parseInt(e.body.resubType)),"4"===s.code&&(s.bot=e.body.bot,s.condition=e.body.condition)),a.findOne(s).then(i=>{i?r.findOne({listener:i._id}).then(e=>{t.json({created:!1,message:'The conditions you selected are already taken by the "'+e.title+'" achievement!'})}):e.body.icon?u(e.body.icon,e.body.iconName,n.owner).then(e=>{o.icon=e.url,new r(o).save().then(n=>{console.log("new achievement in DB"),s.achievement=n.id,new a(s).save().then(i=>{console.log("new listener in DB"),n.listener=i.id,n.save().then(n=>{e.achievementID=n.id,e.save().then(e=>{t.json({created:!0,achievement:n})})})})})}):new r(o).save().then(e=>{console.log("new achievement in DB"),s.achievement=e.id,new a(s).save().then(n=>{console.log("new listener in DB"),e.listener=n.id,e.save().then(e=>{t.json({created:!0,achievement:e})})})})})})})}else t.json({created:!1,message:"This channel you are creating for doesn't exist!"})})}),i.post("/delete",h,(e,t)=>{s.findOne({twitchID:e.user.integration.twitch.etid}).then(n=>{if(n){let i={};i._id=e.body.achievementID,i.channel=n.owner,r.findOne(i).then(e=>{if(e){let n=e.listener;r.deleteOne(i).then(i=>{let o={_id:n,channel:e.channel};a.findOne(o).then(e=>{e?a.deleteOne(o).then(e=>{t.json({deleted:!0})}):t.json({deleted:!0})})})}else t.json({deleted:!1,message:"The achievement you requested to delete doesn't exist!"})})}else t.json({delete:!1,message:"This channel you are deleting for doesn't exist!"})})}),i.get("/retrieve",h,(e,t)=>{let n=e.user.name,i=e.query.aid;i?s.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{if(e){let n=new Promise((t,n)=>{r.findOne({uid:i,channel:e.owner}).then(e=>{if(e){e.listener;a.findOne({_id:e.listener,channel:e.channel}).then(n=>{if(n){let i=Object.assign({},n._doc),o=Object.assign({},e._doc);delete i._id;let s=Object.assign(o,i);t(s)}else t(e)})}else t(null)})}),o=g(e.owner);Promise.all([n,o]).then(n=>{t.json({achievement:n[0],images:n[1],defaultIcons:e.icons})})}else t.json({error:"User isn't a verified channel owner"})}):n&&r.find({channel:n}).then(e=>{if(e){let n=e.map(e=>e.listener);a.find({_id:{$in:n}}).then(n=>{e.forEach(e=>{let t=n.find(t=>t._id=e.listener);return delete t._id,Object.assign(e,t)}),t.json(e)})}else t.json(e)})}),i.post("/award",h,(e,t)=>{let n=e.body.members,i=e.body.aid;s.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{o.find({name:{$in:n}}).then(n=>{let s=n.map((t,n)=>{let o=t.channels,s=o.findIndex(t=>t.channelID===e.id);return o[s].achievements.push({aid:i,earned:Date.now()}),t.channels=o,console.log(t.channels[0].achievements),t.save().then(e=>{console.log(e.channels[0].achievements)})});Promise.all(s).then(n=>{o.find({_id:{$in:e.members}}).then(n=>{let i=n.map(t=>({name:t.name,logo:t.logo,achievements:t.channels.filter(t=>t.channelID===e.id)[0].achievements}));t.json({members:i})})})})})}),i.get("/icons",h,(e,t)=>{s.findOne({twitchID:e.user.integration.twitch.etid}).then(e=>{e?g(e.owner).then(n=>{t.json({images:n,defaultIcons:e.icons})}):t.json({error:!0})})}),i.get("/listeners",(e,t)=>{console.log("/achievement/listeners");let n=e.query.channel;Array.isArray(n)||(n=n.split(",")),console.log(n),a.find({channel:{$in:n}}).then(e=>{e.length>0?t.json(e):t.json([])})}),i.post("/listeners",(e,t)=>{console.log("achievements to process..."),console.log(e.body);let n=e.body,i=new Date;n.forEach(e=>{let{channel:n,achievement:r,tier:a,userID:d}=e;o.findOne({"integration.twitch.etid":d}).then(e=>{e?s.find({owner:n}).then(n=>{let o=e.channels.findIndex(e=>e.channelID===n._id);o>=0?e.channels[o].achievements.includes(r.achievementID)?t.json({message:"This user already earned this achievement!"}):e.channels[o].achievements.push({id:r.achievementID,earned:i}):(e.channels.push({channelID:n._id,achievements:[{id:r.achievementID,earned:i}]}),e.save().then(e=>{new c({twitchID:d,channelID:n._id,achievementID:r.achievementID}).save().then(e=>{t.json({message:"Achievement has been awarded!"})})}))}):s.find({owner:n}).then(e=>{new l({twitchID:d,channelID:e._id,achievementID:r.achievementID}).save().then(e=>{t.json({message:"User hasn't signed up yet, but their achievement earning is stored!"})})})})})}),e.exports=i},function(e,t,n){const i=n(0),o=new(0,i.Schema)({twitchID:String,channelID:String,achievement:String}),s=i.model("queue",o);e.exports=s},function(e,t,n){const i=n(0),o=new(0,i.Schema)({twitchID:String,channelID:String,achievementID:String}),s=i.model("notice",o);e.exports=s},function(e,t,n){const i=n(2).Router(),o=n(1);n(6),n(7),n(0);i.get("/channels",(e,t)=>{o.find({$or:[{type:"verified"},{type:"admin"}]}).then(e=>{let n=e.map(e=>{let t={name:e.name,full_access:!1},n=e.integration.patreon;return n&&(n.forever||n.is_gold)&&(t.full_access=!0),t});console.log(n),t.json({channels:n})})}),e.exports=i}]);