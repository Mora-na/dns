export default {
  async fetch(request, env, ctx) {
    // 提取 DNS 请求中的域名
    const url = new URL(request.url);
    const hostname = url.hostname;

    // 定义需要过滤的域名列表
    const appleDomains = [
      'ocsp.apple.com',
      'ocsp2.apple.com',
      'valid.apple.com',
      'crl.apple.com',
      'certs.apple.com',
      'appattest.apple.com',
      'vpp.itunes.apple.com'
    ];

    // 判断是否为需要过滤的域名
    if (appleDomains.includes(hostname)) {
      // 如果是需要过滤的域名，返回127.0.0.1
      return new Response('127.0.0.1', { status: 200 });
    }

    // 如果不是需要过滤的域名，使用阿里云公共 DNS 服务解析
    const dnsResponse = await fetch(`https://dns.alidns.com/resolve?name=${hostname}&type=A`);
    const dnsData = await dnsResponse.json();

    // 检查解析结果是否有效
    if (dnsData.Status === 0 && dnsData.Answer) {
      // 提取并返回解析的 IP 地址
      const ip = dnsData.Answer[0].data;
      return new Response(ip, { status: 200 });
    }

    // 如果无法解析，返回 404
    return new Response('DNS resolution failed', { status: 404 });
  }
};
