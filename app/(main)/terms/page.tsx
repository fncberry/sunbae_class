import type { Metadata } from "next";
import Link from "next/link";
import { Clause, Items, LegalDoc } from "@/components/LegalDoc";
import { INSTRUCTOR_SHARE_PERCENT } from "@/lib/format";
import { OPERATOR, POLICY_EFFECTIVE_DATE } from "@/lib/site";

export const metadata: Metadata = { title: "이용약관 | 선배클래스" };

export default function TermsPage() {
  return (
    <LegalDoc title="이용약관" effective={POLICY_EFFECTIVE_DATE}>
      <Clause title="제1조 (목적)">
        <p>
          이 약관은 {OPERATOR.name}(이하 &ldquo;운영자&rdquo;)가 운영하는 선배클래스(이하 &ldquo;서비스&rdquo;)를 이용하는 조건과 절차, 운영자와 회원의 권리·의무를
          정합니다.
        </p>
      </Clause>

      <Clause title="제2조 (용어)">
        <Items>
          <li>&ldquo;회원&rdquo;은 고려대학교 구글 계정으로 가입하고 가입 마무리를 마친 사람이에요.</li>
          <li>&ldquo;선배&rdquo;는 성적 인증을 받아 강의를 올리는 회원이에요.</li>
          <li>&ldquo;수강생&rdquo;은 강의를 구매한 회원이에요.</li>
          <li>&ldquo;강의&rdquo;는 선배가 특정 과목(교수님·분반) 시험을 대비해 만든 영상과 자료예요.</li>
          <li>&ldquo;수강권&rdquo;은 결제가 확인되면 발급되는, 강의를 볼 수 있는 권리예요.</li>
        </Items>
      </Clause>

      <Clause title="제3조 (약관의 게시와 변경)">
        <Items>
          <li>운영자는 이 약관을 서비스 화면 아래쪽에서 언제든 볼 수 있게 둬요.</li>
          <li>약관을 바꿀 때는 적용일과 바꾼 내용을 적용 7일 전부터 서비스에 알려요. 회원에게 불리한 변경은 30일 전부터 알려요.</li>
          <li>회원이 바뀐 약관에 동의하지 않으면 탈퇴할 수 있어요. 적용일 뒤에도 계속 이용하면 동의한 것으로 봐요.</li>
        </Items>
      </Clause>

      <Clause title="제4조 (가입)">
        <Items>
          <li>고려대학교 구글 계정(korea.ac.kr)이 있는 사람만 가입할 수 있어요.</li>
          <li>가입 마무리에서 이름, 닉네임, 학번, 학과를 사실대로 적어야 해요. 학번은 영상 워터마크에 쓰여서 한 학번은 한 계정에만 쓸 수 있어요.</li>
          <li>남의 정보로 가입했거나 사실과 다른 정보를 적으면 이용을 제한할 수 있어요.</li>
        </Items>
      </Clause>

      <Clause title="제5조 (탈퇴)">
        <p>
          회원은 언제든 {OPERATOR.email}로 탈퇴를 요청할 수 있고, 운영자는 바로 처리해요. 탈퇴하면 수강권도 함께 없어지니, 볼 수 있는 강의가 남아 있다면
          먼저 확인해 주세요. 개인정보 처리는{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            개인정보처리방침
          </Link>
          을 따라요.
        </p>
      </Clause>

      <Clause title="제6조 (강의 구매와 수강권)">
        <Items>
          <li>결제는 그로블(Groble) 결제창에서 이뤄지고, 결제 수단과 결제 정보는 그로블이 처리해요.</li>
          <li>결제가 확인되면 바로 수강권이 발급되고, &lsquo;내 강의&rsquo;에서 볼 수 있어요.</li>
          <li>운영자는 해당 과목 시험일까지 강의를 볼 수 있게 해요. 시험일이 지난 뒤에도 볼 수 있게 둘 수 있지만 보장하지는 않아요.</li>
          <li>수강권은 구매한 회원 본인만 쓸 수 있어요. 계정을 다른 사람과 나눠 쓸 수 없어요.</li>
        </Items>
      </Clause>

      <Clause title="제7조 (환불)">
        <Items>
          <li>해당 과목 시험일 당일까지, 강의 전체 챕터 중 들은 챕터가 30% 미만이면 전액 환불해요.</li>
          <li>시험일이 지났거나 30% 이상 들었다면 디지털 콘텐츠를 이미 이용한 것으로 보아 환불하지 않아요. 맛보기 챕터와 강의 소개로 내용을 미리 확인할 수 있어요.</li>
          <li>영상이 재생되지 않거나 강의 소개와 내용이 크게 다르면, 위 기준과 상관없이 전액 환불해요.</li>
          <li>환불은 그로블 결제 내역이나 {OPERATOR.email}로 요청할 수 있어요. 환불이 끝나면 수강권은 회수돼요.</li>
        </Items>
      </Clause>

      <Clause title="제8조 (선배의 강의)">
        <Items>
          <li>선배는 같은 과목·같은 교수님 수업에서 받은 성적을 인증해야 그 과목 강의를 올릴 수 있어요. 성적 증빙 캡처는 확인이 끝나면 바로 지워요.</li>
          <li>강의는 운영자 검수를 거쳐 판매돼요. 운영자는 이 약관이나 법에 맞지 않는 강의를 반려하거나 판매를 멈출 수 있어요.</li>
          <li>강의의 저작권은 선배에게 있어요. 선배는 운영자가 강의를 서비스에서 보여 주고 판매하는 데 필요한 범위에서 강의를 쓰도록 허락해요.</li>
          <li>
            선배는 교수님 강의 자료·시험 문제를 허락 없이 그대로 옮기거나, 남의 저작물을 침해하거나, 성적을 거짓으로 인증해서는 안 돼요. 이를 어기면 강의를
            내리고 정산을 멈출 수 있어요.
          </li>
        </Items>
      </Clause>

      <Clause title="제9조 (정산)">
        <Items>
          <li>선배는 강의 결제 금액의 {INSTRUCTOR_SHARE_PERCENT}%를 받아요. 결제 수수료는 운영자가 부담해요.</li>
          <li>시험일이 지나 환불될 수 없게 된 결제를 모아 매달 한 번, 선배가 등록한 계좌로 보내요.</li>
          <li>정산 뒤에 환불된 결제가 있으면 그만큼을 다음 정산에서 빼요.</li>
          <li>관련 법령에 따라 세금을 떼고 보낼 수 있어요.</li>
        </Items>
      </Clause>

      <Clause title="제10조 (회원이 지킬 것)">
        <Items>
          <li>강의 영상을 녹화·캡처·다운로드해서 퍼뜨리거나 팔면 안 돼요. 영상에는 시청자 학번이 워터마크로 들어가요.</li>
          <li>후기와 질문에 욕설, 남을 깎아내리는 내용, 광고, 개인정보를 쓰면 안 돼요. 이런 글은 운영자가 지울 수 있어요.</li>
          <li>이를 어기면 이용을 제한하거나 수강권을 회수할 수 있어요. 손해가 생기면 배상을 청구할 수 있어요.</li>
        </Items>
      </Clause>

      <Clause title="제11조 (게시물)">
        <p>
          후기와 질문의 권리는 작성자에게 있어요. 운영자는 서비스 안에서 보여 주는 데 필요한 범위에서만 써요. 탈퇴해도 남긴 글은 &lsquo;학과 NN학번&rsquo;
          표시로 남을 수 있고, 탈퇴 전에 지워 달라고 요청할 수 있어요.
        </p>
      </Clause>

      <Clause title="제12조 (책임의 한계)">
        <Items>
          <li>강의는 시험 준비를 돕는 자료일 뿐이고, 특정 성적을 보장하지 않아요.</li>
          <li>시스템 점검, 천재지변, 외부 서비스(결제·호스팅·영상) 장애로 서비스를 잠시 못 쓸 수 있어요. 이때 운영자는 최대한 빨리 알리고 복구해요.</li>
          <li>운영자의 고의나 중대한 과실이 없는 한, 회원 사이(선배와 수강생 등)에 생긴 분쟁은 당사자가 해결해요. 운영자는 해결을 도울 수 있어요.</li>
        </Items>
      </Clause>

      <Clause title="제13조 (분쟁 해결)">
        <p>
          문의와 불만은 {OPERATOR.email}로 받아요. 이 약관은 대한민국 법을 따르고, 분쟁이 소송으로 가면 민사소송법에 따른 관할 법원에서 다퉈요.
        </p>
      </Clause>
    </LegalDoc>
  );
}
