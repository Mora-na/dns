const BLOCKED_DOMAINS = [
  'ocsp.apple.com',
  'ocsp2.apple.com',
  'valid.apple.com',
  'crl.apple.com',
  'certs.apple.com',
  'appattest.apple.com',
  'vpp.itunes.apple.com'
  // 在此处添加其他需要屏蔽的域名
];

const ALI_DNS_IPV4 = ['223.5.5.5', '223.6.6.6'];
const ALI_DNS_IPV6 = ['2400:3200::1', '2400:3200:baba::1'];
const ALI_DNS_DOT = 'dns.alidns.com';

async function handleDnsRequest(request) {
  // 检查是否是 DoT 请求
  if (request.headers.get('x-forwarded-proto') !== 'https') {
    return new Response('Only DoT is supported', { status: 400 });
  }

  const url = new URL(request.url);
  const hostname = url.hostname;

  // 检查域名是否在屏蔽列表中
  if (BLOCKED_DOMAINS.includes(hostname)) {
    // 如果域名在屏蔽列表中，返回127.0.0.1
    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': 'application/dns-message',
        'Cache-Control': 'no-cache',
        'Content-Encoding': 'gzip',
      },
      body: buildDnsResponse('127.0.0.1'),
    });
  }

  // 查询阿里云 DNS 服务
  const dnsResponse = await queryAliDns(hostname);

  if (!dnsResponse) {
    return new Response('DNS query failed', { status: 502 });
  }

  return new Response(dnsResponse, {
    status: 200,
    headers: {
      'Content-Type': 'application/dns-message',
      'Cache-Control': 'no-cache',
      'Content-Encoding': 'gzip',
    },
  });
}

async function queryAliDns(hostname) {
  // 创建 DoT 请求的 URL
  const url = `https://${ALI_DNS_DOT}/resolve?name=${hostname}&type=A`;

  // 发起请求查询
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const responseBody = await response.arrayBuffer();
  return new Uint8Array(responseBody);
}

function buildDnsResponse(ip) {
  // 构造一个简单的 DNS 响应，返回指定的 IP 地址
  const ipArray = ip.split('.').map(Number);
  const dnsResponse = [
    0x85, 0x00, // ID: 0x8500 (request ID)
    0x81, 0x80, // 标志字段 (Response, No Error)
    0x00, 0x01, // 问题数 (1)
    0x00, 0x01, // 记录数 (1)
    0x00, 0x00, // 附加记录数 (0)
    0x00, 0x00, // 名称指针 (0)
    ...hostnameToDnsLabel(hostname), // 域名部分
    0x00, // 域名结束符
    0x00, 0x01, // 查询类型 A
    0x00, 0x01, // 查询类 IN
    0x00, 0x00, 0x00, 0x10, 0x00, 0x04, // TTL 16秒，数据长度 4
    ...ipArray, // IP 地址
  ];

  return new Uint8Array(dnsResponse);
}

function hostnameToDnsLabel(hostname) {
  const labels = hostname.split('.').map(label => {
    const length = label.length;
    return [length, ...Array.from(label).map(c => c.charCodeAt(0))];
  });

  return labels.flat();
}

addEventListener('fetch', event => {
  event.respondWith(handleDnsRequest(event.request));
});
