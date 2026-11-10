-- 적용 뒤 점검(읽기만): Google 출처만 새로 구분되고, 다른 출처 표시는 예전과 같다.
do $$
begin
 if location_private.safe_source('Google ChIJabc (company)') <> 'Google' then raise exception 'Google origin not labelled'; end if;
 if location_private.safe_source('VietMap geocode:ABC') <> 'VietMap' then raise exception 'VietMap label changed'; end if;
 if location_private.safe_source('Google → VietMap verified') <> 'VietMap' then raise exception 'VietMap-verified must stay VietMap'; end if;
 if location_private.safe_source('OpenStreetMap way/1') <> 'OpenStreetMap' then raise exception 'OSM label changed'; end if;
 if location_private.safe_source('admin_approved') <> 'admin_approved' then raise exception 'admin label changed'; end if;
 if location_private.safe_source('poster_pin') <> 'poster_pin' then raise exception 'poster label changed'; end if;
 if location_private.safe_source('Goong place') <> 'source_evidence' then raise exception 'other sources must stay source_evidence'; end if;
 if location_private.safe_source(null) <> 'source_evidence' then raise exception 'null must stay source_evidence'; end if;
end $$;
