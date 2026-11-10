-- 시험 DB 전용: 로그인한 본인만 쓰기, 남의 이름으로 못 씀, 성별·국적은 남이 못 봄, 같은 회사는 한 곳에 모임.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.ks_profiles (user_id, nickname, gender, nationality, visa, region)
  values ('00000000-0000-0000-0000-0000000000a1', 'Minh', 'nam', 'VN', 'E-9', 'Gyeonggi');
insert into public.ks_posts (author_id, topic, title, body) values ('00000000-0000-0000-0000-0000000000a1', 'doi-cong-ty', 'Đổi công ty E-9', 'Cần chuẩn bị gì?');
do $t$ begin
  begin
    insert into public.ks_posts (author_id, topic, title, body) values ('00000000-0000-0000-0000-0000000000b2', 'visa', 'Giả danh', 'người khác');
    raise exception '남의 이름으로 글 쓰기가 됨';
  exception when insufficient_privilege or foreign_key_violation then null; end;
  perform public.ks_add_review('Hanil Tech', 'Gyeonggi', 'Ép nhựa', 250, 'nhieu', true, 5, 'ok');
  perform public.ks_add_review(' hanil tech ', 'gyeonggi', null, 260, 'vua', true, 6, null);
  if (select count(*) from public.ks_companies) <> 1 then raise exception '같은 회사가 둘로 갈림'; end if;
  if (select count(*) from public.ks_reviews where author_visa = 'E-9') <> 2 then raise exception '후기 비자가 프로필에서 안 채워짐'; end if;
  if (select gender from public.ks_my_profile()) <> 'nam' then raise exception '본인 프로필 못 읽음'; end if;
  begin
    update public.ks_profiles set gender = 'nu';
    raise exception '성별을 바꿀 수 있음';
  exception when insufficient_privilege then null; end;
end $t$;
reset role;
set role anon;
do $t$ begin
  if (select count(*) from public.ks_posts) <> 1 then raise exception '손님이 글을 못 읽음'; end if;
  begin
    perform gender from public.ks_profiles;
    raise exception '손님이 성별을 봄';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ks_comments (post_id, author_id, body) values (1, '00000000-0000-0000-0000-0000000000a1', 'x');
    raise exception '손님이 댓글을 씀';
  exception when insufficient_privilege then null; end;
end $t$;
reset role;
